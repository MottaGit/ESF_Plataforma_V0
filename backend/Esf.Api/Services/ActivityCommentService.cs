using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Comentarios das atividades. Quem escreve edita e apaga o proprio; a coordenacao tambem apaga os dos outros.
/// Mencionados com @ e o responsavel pela atividade recebem aviso.
/// </summary>
public class ActivityCommentService
{
    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly NotificationService _notifications;

    public ActivityCommentService(EsfDbContext db, ICurrentUser currentUser, NotificationService notifications)
    {
        _db = db;
        _currentUser = currentUser;
        _notifications = notifications;
    }

    private bool CanModerate => _currentUser.Role is UserRole.Administrador or UserRole.Coordenador;

    public async Task<List<CommentDto>> ListAsync(Guid activityId)
    {
        var comments = await _db.ActivityComments.AsNoTracking()
            .Include(c => c.AuthorUser).ThenInclude(u => u!.Volunteer)
            .Where(c => c.ActivityId == activityId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        var mentioned = comments.SelectMany(c => c.MentionedVolunteerIds).Distinct().ToList();
        var names = await _db.Volunteers.AsNoTracking()
            .Where(v => mentioned.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, v => v.Name);

        return comments.Select(c => ToDto(c, names)).ToList();
    }

    /// <summary>Quem pode ser mencionado: voluntarios com acesso ativo (so eles veem o aviso); a equipe vem primeiro.</summary>
    public async Task<List<MentionableDto>> MentionableAsync(Guid activityId)
    {
        var projectId = await _db.Activities.Where(a => a.Id == activityId).Select(a => (Guid?)a.ProjectId).FirstOrDefaultAsync()
                        ?? throw AppException.NotFound("Tarefa", feminine: true);

        var team = await _db.ProjectVolunteers.Where(pv => pv.ProjectId == projectId).Select(pv => pv.VolunteerId).ToListAsync();

        var people = await _db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.VolunteerId != null && u.Volunteer!.AnonymizedAt == null)
            .Select(u => new { u.Volunteer!.Id, u.Volunteer.Name, u.Volunteer.PhotoStoredName })
            .ToListAsync();

        return people
            .Select(p => new MentionableDto(p.Id, p.Name, Mapping.PhotoUrl(p.PhotoStoredName), team.Contains(p.Id)))
            .OrderByDescending(p => p.InTeam).ThenBy(p => p.Name)
            .ToList();
    }

    public async Task<CommentDto> AddAsync(Guid activityId, SaveCommentRequest request)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId) ?? throw AppException.NotFound("Tarefa", feminine: true);
        var mentions = await ValidMentionsAsync(request.MentionedVolunteerIds);

        var comment = new ActivityComment
        {
            ActivityId = activity.Id,
            AuthorUserId = _currentUser.RequireId(),
            Text = request.Text.Trim(),
            MentionedVolunteerIds = mentions
        };
        _db.ActivityComments.Add(comment);
        await _notifications.CommentedAsync(activity, comment.Text, mentions, notifyAssignee: true);
        await TouchProjectAsync(activity.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(comment.Id);
    }

    public async Task<CommentDto> UpdateAsync(Guid commentId, SaveCommentRequest request)
    {
        var comment = await _db.ActivityComments.Include(c => c.Activity).FirstOrDefaultAsync(c => c.Id == commentId)
                      ?? throw AppException.NotFound("Comentario");
        if (comment.AuthorUserId != _currentUser.RequireId())
            throw new AppException("So quem escreveu pode editar o comentario.", StatusCodes.Status403Forbidden);

        var mentions = await ValidMentionsAsync(request.MentionedVolunteerIds);
        var newMentions = mentions.Except(comment.MentionedVolunteerIds).ToList();

        comment.Text = request.Text.Trim();
        comment.MentionedVolunteerIds = mentions;
        comment.EditedAt = DateTime.UtcNow;
        // Na edicao, so quem foi mencionado agora recebe aviso.
        await _notifications.CommentedAsync(comment.Activity!, comment.Text, newMentions, notifyAssignee: false);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(comment.Id);
    }

    public async Task DeleteAsync(Guid commentId)
    {
        var comment = await _db.ActivityComments.Include(c => c.Activity).FirstOrDefaultAsync(c => c.Id == commentId)
                      ?? throw AppException.NotFound("Comentario");
        if (comment.AuthorUserId != _currentUser.RequireId() && !CanModerate)
            throw new AppException("Voce so pode apagar os seus comentarios.", StatusCodes.Status403Forbidden);

        _db.ActivityComments.Remove(comment);
        await _db.SaveChangesAsync();
    }

    private async Task<List<Guid>> ValidMentionsAsync(IEnumerable<Guid>? ids)
    {
        var wanted = (ids ?? Enumerable.Empty<Guid>()).Distinct().ToList();
        if (wanted.Count == 0) return wanted;
        return await _db.Volunteers.Where(v => wanted.Contains(v.Id)).Select(v => v.Id).ToListAsync();
    }

    private async Task<CommentDto> GetDtoAsync(Guid id)
    {
        var comment = await _db.ActivityComments.AsNoTracking()
            .Include(c => c.AuthorUser).ThenInclude(u => u!.Volunteer)
            .FirstAsync(c => c.Id == id);
        var names = await _db.Volunteers.AsNoTracking()
            .Where(v => comment.MentionedVolunteerIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, v => v.Name);
        return ToDto(comment, names);
    }

    private CommentDto ToDto(ActivityComment c, IReadOnlyDictionary<Guid, string> names)
    {
        var mine = c.AuthorUserId.HasValue && c.AuthorUserId == _currentUser.Id;
        return new CommentDto(
            c.Id,
            c.AuthorUserId,
            Mapping.PersonName(c.AuthorUser) ?? "Acesso removido",
            Mapping.PhotoUrl(c.AuthorUser?.Volunteer?.PhotoStoredName),
            c.Text,
            c.MentionedVolunteerIds.Where(names.ContainsKey).Select(id => new MentionDto(id, names[id])).ToList(),
            c.CreatedAt,
            c.EditedAt,
            mine,
            mine || CanModerate);
    }

    private async Task TouchProjectAsync(Guid projectId)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is not null) project.UpdatedAt = DateTime.UtcNow;
    }
}
