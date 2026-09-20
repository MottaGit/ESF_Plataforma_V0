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

    public ActivityService(EsfDbContext db) => _db = db;

    public async Task<List<ActivityDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var activities = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedUser)
            .Where(a => a.ProjectId == projectId)
            .OrderBy(a => a.Status)
            .ThenByDescending(a => a.Priority)
            .ToListAsync();

        return activities.Select(Mapping.ToDto).ToList();
    }

    /// <summary>Atividades pendentes com prazo proximo, usadas no dashboard.</summary>
    public async Task<List<ActivityDto>> ListUpcomingAsync(int take = 8)
    {
        var activities = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedUser)
            .Include(a => a.Project)
            .Where(a => a.Status != ActivityStatus.Concluida && !a.Project!.IsArchived)
            .OrderBy(a => a.DueDate ?? DateOnly.MaxValue)
            .ThenByDescending(a => a.Priority)
            .Take(take)
            .ToListAsync();

        return activities.Select(Mapping.ToDto).ToList();
    }

    public async Task<ActivityDto> CreateAsync(Guid projectId, SaveActivityRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        await EnsureAssigneeExistsAsync(request.AssignedUserId);

        var activity = new Activity { ProjectId = projectId };
        Apply(activity, request);
        activity.CreatedAt = DateTime.UtcNow;

        _db.Activities.Add(activity);
        await TouchProjectAsync(projectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(activity.Id);
    }

    public async Task<ActivityDto> UpdateAsync(Guid id, SaveActivityRequest request)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Atividade");
        await EnsureAssigneeExistsAsync(request.AssignedUserId);

        Apply(activity, request);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(id);
    }

    public async Task<ActivityDto> UpdateStatusAsync(Guid id, ActivityStatus status)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Atividade");

        activity.Status = status;
        activity.CompletedAt = status == ActivityStatus.Concluida ? DateTime.UtcNow : null;

        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Atividade");

        _db.Activities.Remove(activity);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();
    }

    private async Task<ActivityDto> GetDtoAsync(Guid id)
    {
        var activity = await _db.Activities
            .AsNoTracking()
            .Include(a => a.AssignedUser)
            .FirstOrDefaultAsync(a => a.Id == id) ?? throw AppException.NotFound("Atividade");

        return Mapping.ToDto(activity);
    }

    private async Task EnsureAssigneeExistsAsync(Guid? userId)
    {
        if (userId.HasValue && !await _db.Users.AnyAsync(u => u.Id == userId.Value))
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
        activity.AssignedUserId = r.AssignedUserId;
        activity.Status = r.Status!.Value;
        activity.Priority = r.Priority!.Value;
        activity.DueDate = r.DueDate;
        activity.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();

        if (activity.Status == ActivityStatus.Concluida)
            activity.CompletedAt ??= DateTime.UtcNow;
        else
            activity.CompletedAt = null;
    }
}
