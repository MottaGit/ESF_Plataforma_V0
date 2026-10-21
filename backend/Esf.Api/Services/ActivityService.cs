using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ActivityService
{
    private readonly EsfDbContext _db;
    private readonly NotificationService _notifications;
    private readonly ActivityCommentService _comments;

    public ActivityService(EsfDbContext db, NotificationService notifications, ActivityCommentService comments)
    {
        _db = db;
        _notifications = notifications;
        _comments = comments;
    }

    public async Task<List<ActivityDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var activities = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedVolunteer)
            .Where(a => a.ProjectId == projectId)
            .OrderBy(a => a.Status)
            .ThenByDescending(a => a.Priority)
            .ToListAsync();

        return await WithCountsAsync(activities);
    }

    /// <summary>Concluidas que continuam aparecendo no quadro de atividades.</summary>
    public const int BoardDoneDays = 30;

    /// <summary>
    /// Quadro de atividades: as atividades de todos os projetos em planejamento ou em andamento (nao
    /// arquivados). Das concluidas, so as dos ultimos <see cref="BoardDoneDays"/> dias. Filtros e ordem
    /// ficam no navegador.
    /// </summary>
    public async Task<List<ActivityDto>> ListBoardAsync()
    {
        var doneSince = DateTime.UtcNow.AddDays(-BoardDoneDays);

        var activities = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedVolunteer)
            .Include(a => a.Project).ThenInclude(p => p!.Program)
            .Where(a => !a.Project!.IsArchived
                && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento)
                && (a.Status != ActivityStatus.Concluida || a.CompletedAt >= doneSince))
            .ToListAsync();

        return await WithCountsAsync(activities);
    }

    /// <summary>Atividades pendentes com prazo proximo, usadas no dashboard.</summary>
    public async Task<List<ActivityDto>> ListUpcomingAsync(int take = 8, Guid? assignedVolunteerId = null)
    {
        var query = _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedVolunteer)
            .Include(a => a.Project)
            .Where(a => a.Status != ActivityStatus.Concluida && !a.Project!.IsArchived);

        if (assignedVolunteerId.HasValue)
            query = query.Where(a => a.AssignedVolunteerId == assignedVolunteerId.Value);

        var activities = await query
            .OrderBy(a => a.DueDate ?? DateOnly.MaxValue)
            .ThenByDescending(a => a.Priority)
            .Take(take)
            .ToListAsync();

        return activities.Select(Mapping.ToDto).ToList();
    }

    /// <summary>"Minhas atividades": pendentes atribuidas ao voluntario vinculado ao usuario.</summary>
    public async Task<List<ActivityDto>> ListUpcomingForUserAsync(Guid userId, int take = 8)
    {
        var volunteerId = await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.VolunteerId)
            .FirstOrDefaultAsync();

        // Sem voluntario vinculado nao ha como saber quais atividades sao da pessoa.
        return volunteerId.HasValue ? await ListUpcomingAsync(take, volunteerId.Value) : new List<ActivityDto>();
    }

    public async Task<ActivityDto> CreateAsync(Guid projectId, SaveActivityRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        await EnsureAssigneeExistsAsync(request.AssignedVolunteerId);

        var activity = new Activity { ProjectId = projectId };
        Apply(activity, request);
        activity.CreatedAt = DateTime.UtcNow;

        _db.Activities.Add(activity);
        await ProjectTeam.EnsureMemberAsync(_db, projectId, activity.AssignedVolunteerId);
        await _notifications.ActivityAssignedAsync(activity);
        await TouchProjectAsync(projectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(activity.Id);
    }

    public async Task<ActivityDto> UpdateAsync(Guid id, SaveActivityRequest request)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Tarefa", feminine: true);
        await EnsureAssigneeExistsAsync(request.AssignedVolunteerId);

        var previousAssignee = activity.AssignedVolunteerId;
        var previousStatus = activity.Status;

        Apply(activity, request);
        await ProjectTeam.EnsureMemberAsync(_db, activity.ProjectId, activity.AssignedVolunteerId);

        // Mudou o responsavel: o aviso de atribuicao ja basta; senao, avisa da mudanca de status (se houver).
        if (activity.AssignedVolunteerId.HasValue && activity.AssignedVolunteerId != previousAssignee)
            await _notifications.ActivityAssignedAsync(activity);
        else
            await _notifications.ActivityStatusChangedAsync(activity, previousStatus);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(id);
    }

    public async Task<ActivityDto> UpdateStatusAsync(Guid id, ActivityStatus status, string? blockedReason = null)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Tarefa", feminine: true);

        var previousStatus = activity.Status;
        activity.Status = status;
        activity.CompletedAt = status == ActivityStatus.Concluida ? DateTime.UtcNow : null;
        activity.BlockedReason = BlockedReasonFor(status, blockedReason);
        await _notifications.ActivityStatusChangedAsync(activity, previousStatus);

        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Tarefa", feminine: true);

        _db.Activities.Remove(activity);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();
    }

    private async Task<ActivityDto> GetDtoAsync(Guid id)
    {
        var activity = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedVolunteer)
            .Include(a => a.Project).ThenInclude(p => p!.Program)
            .FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Tarefa", feminine: true);

        return (await WithCountsAsync(new List<Activity> { activity }))[0];
    }

    /// <summary>DTOs com o resumo do checklist e dos anexos (para os cards e a lista).</summary>
    private async Task<List<ActivityDto>> WithCountsAsync(List<Activity> activities)
    {
        var counts = await ActivityCounts.ForAsync(_db, activities.Select(a => a.Id).ToList());
        return activities.Select(a => Mapping.ToDto(a, counts.GetValueOrDefault(a.Id))).ToList();
    }

    // ---------- dentro da atividade: checklist e anexos ----------

    public async Task<ActivityDetailsDto> GetDetailsAsync(Guid id)
    {
        if (!await _db.Activities.AnyAsync(a => a.Id == id))
            throw AppException.NotFound("Tarefa", feminine: true);

        var checklist = await _db.ActivityChecklistItems.AsNoTracking()
            .Where(i => i.ActivityId == id)
            .OrderBy(i => i.Position).ThenBy(i => i.CreatedAt)
            .Select(i => new ChecklistItemDto(i.Id, i.Text, i.Done, i.DoneAt))
            .ToListAsync();

        var attachments = await _db.ProjectFiles.AsNoTracking()
            .Include(f => f.UploadedByUser).ThenInclude(u => u!.Volunteer)
            .Include(f => f.Activity)
            .Where(f => f.ActivityId == id)
            .OrderBy(f => f.UploadedAt)
            .ToListAsync();

        return new ActivityDetailsDto(checklist, attachments.Select(Mapping.ToDto).ToList(), await _comments.ListAsync(id));
    }

    public async Task<ChecklistItemDto> AddChecklistItemAsync(Guid activityId, SaveChecklistItemRequest request)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId)
                       ?? throw AppException.NotFound("Tarefa", feminine: true);

        var position = await _db.ActivityChecklistItems
            .Where(i => i.ActivityId == activityId)
            .MaxAsync(i => (int?)i.Position) ?? -1;

        var item = new ActivityChecklistItem { ActivityId = activity.Id, Text = request.Text.Trim(), Position = position + 1 };
        _db.ActivityChecklistItems.Add(item);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();
        return new ChecklistItemDto(item.Id, item.Text, item.Done, item.DoneAt);
    }

    public async Task<ChecklistItemDto> UpdateChecklistItemAsync(Guid itemId, UpdateChecklistItemRequest request)
    {
        var item = await _db.ActivityChecklistItems.Include(i => i.Activity).FirstOrDefaultAsync(i => i.Id == itemId)
                   ?? throw AppException.NotFound("Item do checklist");

        if (!string.IsNullOrWhiteSpace(request.Text)) item.Text = request.Text.Trim();
        if (request.Done.HasValue && request.Done.Value != item.Done)
        {
            item.Done = request.Done.Value;
            item.DoneAt = item.Done ? DateTime.UtcNow : null;
        }

        await TouchProjectAsync(item.Activity!.ProjectId);
        await _db.SaveChangesAsync();
        return new ChecklistItemDto(item.Id, item.Text, item.Done, item.DoneAt);
    }

    public async Task DeleteChecklistItemAsync(Guid itemId)
    {
        var item = await _db.ActivityChecklistItems.Include(i => i.Activity).FirstOrDefaultAsync(i => i.Id == itemId)
                   ?? throw AppException.NotFound("Item do checklist");

        _db.ActivityChecklistItems.Remove(item);
        await TouchProjectAsync(item.Activity!.ProjectId);
        await _db.SaveChangesAsync();
    }

    private async Task EnsureAssigneeExistsAsync(Guid? volunteerId)
    {
        if (volunteerId.HasValue && !await _db.Volunteers.AnyAsync(v => v.Id == volunteerId.Value))
            throw new AppException("O responsavel informado nao existe.");
    }

    private async Task TouchProjectAsync(Guid projectId)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is not null) project.UpdatedAt = DateTime.UtcNow;
    }

    private static void Apply(Activity activity, SaveActivityRequest r)
    {
        activity.Title = r.Title.Trim();
        activity.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        activity.AssignedVolunteerId = r.AssignedVolunteerId;
        activity.Status = r.Status!.Value;
        activity.Priority = r.Priority!.Value;
        activity.DueDate = r.DueDate;
        activity.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        activity.BlockedReason = BlockedReasonFor(activity.Status, r.BlockedReason);

        if (activity.Status == ActivityStatus.Concluida)
            activity.CompletedAt ??= DateTime.UtcNow;
        else
            activity.CompletedAt = null;
    }

    /// <summary>O motivo do bloqueio so existe enquanto a atividade esta bloqueada.</summary>
    private static string? BlockedReasonFor(ActivityStatus status, string? reason) =>
        status == ActivityStatus.Bloqueada && !string.IsNullOrWhiteSpace(reason) ? reason.Trim() : null;
}
