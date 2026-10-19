using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Avisos do sininho. Os de acao (atribuicao, bloqueio, conclusao, reabertura, equipe, responsavel) sao
/// registrados pelos outros servicos junto com a propria acao, no mesmo SaveChanges; ninguem recebe aviso do
/// que ele mesmo fez. Os lembretes de prazo ("vence amanha" e "vence hoje") sao gerados quando a pessoa
/// consulta os avisos, entao nao precisam de rotina agendada.
/// </summary>
public class NotificationService
{
    /// <summary>Avisos ja lidos somem depois disso.</summary>
    private const int ReadRetentionDays = 30;

    /// <summary>Nao lidos ficam um pouco mais, para quem passou um tempo sem entrar nao perder nada.</summary>
    private const int UnreadRetentionDays = 60;

    /// <summary>Tamanho da lista: os nao lidos aparecem todos (ate MaxUnreadListed) e os lidos completam ate aqui.</summary>
    private const int ListSize = 15;

    private const int MaxUnreadListed = 50;

    private static readonly NotificationType[] DueTypes =
        { NotificationType.ActivityDueTomorrow, NotificationType.ActivityDueToday };

    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;
    private Actor? _actor;

    public NotificationService(EsfDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>Quem esta fazendo a acao: nome exibido e voluntario vinculado (para nao avisar a si mesmo).</summary>
    private record Actor(Guid? UserId, Guid? VolunteerId, string Name);

    // ---------- registro (chamado pelos outros servicos, antes do SaveChanges deles) ----------

    public async Task ActivityAssignedAsync(Activity activity)
    {
        if (!activity.AssignedVolunteerId.HasValue) return;
        var actor = await GetActorAsync();
        await AddAsync(activity.AssignedVolunteerId.Value, NotificationType.ActivityAssigned,
            $"{actor.Name} atribuiu a você \"{activity.Title}\"",
            activity.ProjectId, activity.Id, await ProjectNameAsync(activity.ProjectId));
    }

    /// <summary>Avisa o responsavel quando outra pessoa bloqueia, conclui ou reabre a atividade dele.</summary>
    public async Task ActivityStatusChangedAsync(Activity activity, ActivityStatus previous)
    {
        if (!activity.AssignedVolunteerId.HasValue || activity.Status == previous) return;
        var actor = await GetActorAsync();

        NotificationType type;
        string message;
        switch (activity.Status)
        {
            case ActivityStatus.Bloqueada:
                type = NotificationType.ActivityBlocked;
                message = $"{actor.Name} bloqueou \"{activity.Title}\"" +
                          (string.IsNullOrWhiteSpace(activity.BlockedReason) ? "" : $": {activity.BlockedReason}");
                break;
            case ActivityStatus.Concluida:
                type = NotificationType.ActivityCompleted;
                message = $"{actor.Name} concluiu \"{activity.Title}\"";
                break;
            default:
                // Entre "nao iniciada", "em andamento" e o desbloqueio, nao ha aviso; so ao reabrir uma concluida.
                if (previous != ActivityStatus.Concluida) return;
                type = NotificationType.ActivityReopened;
                message = $"{actor.Name} reabriu \"{activity.Title}\"";
                break;
        }

        await AddAsync(activity.AssignedVolunteerId.Value, type, message,
            activity.ProjectId, activity.Id, await ProjectNameAsync(activity.ProjectId));
    }

    public async Task AddedToTeamAsync(Guid volunteerId, Guid projectId)
    {
        var actor = await GetActorAsync();
        await AddAsync(volunteerId, NotificationType.AddedToTeam,
            $"{actor.Name} adicionou você à equipe de \"{await ProjectNameAsync(projectId)}\"", projectId, null, null);
    }

    public async Task ProjectOwnerAsync(Guid volunteerId, Guid projectId, string projectName)
    {
        var actor = await GetActorAsync();
        await AddAsync(volunteerId, NotificationType.ProjectOwner,
            $"{actor.Name} definiu você como responsável por \"{projectName}\"", projectId, null, null);
    }

    // ---------- consulta (sininho) ----------

    public async Task<UnreadNotificationsDto> GetUnreadAsync()
    {
        var volunteerId = await MyVolunteerIdAsync();
        if (!volunteerId.HasValue) return new UnreadNotificationsDto(false, 0);

        await EnsureDueRemindersAsync(volunteerId.Value);
        return new UnreadNotificationsDto(true, await Visible(volunteerId.Value).CountAsync(n => n.ReadAt == null));
    }

    public async Task<NotificationsDto> ListAsync()
    {
        var volunteerId = await MyVolunteerIdAsync();
        if (!volunteerId.HasValue) return new NotificationsDto(false, 0, new List<NotificationDto>());

        var readCutoff = DateTime.UtcNow.AddDays(-ReadRetentionDays);
        var unreadCutoff = DateTime.UtcNow.AddDays(-UnreadRetentionDays);
        await _db.Notifications
            .Where(n => n.VolunteerId == volunteerId.Value
                        && (n.CreatedAt < unreadCutoff || (n.ReadAt != null && n.CreatedAt < readCutoff)))
            .ExecuteDeleteAsync();
        await EnsureDueRemindersAsync(volunteerId.Value);

        // Nenhum nao lido fica de fora; os lidos so completam a lista.
        var unreadItems = await ToDtos(Visible(volunteerId.Value).Where(n => n.ReadAt == null), MaxUnreadListed);
        var readItems = unreadItems.Count < ListSize
            ? await ToDtos(Visible(volunteerId.Value).Where(n => n.ReadAt != null), ListSize - unreadItems.Count)
            : new List<NotificationDto>();
        var unread = await Visible(volunteerId.Value).CountAsync(n => n.ReadAt == null);

        var items = unreadItems.Concat(readItems).OrderByDescending(n => n.CreatedAt).ToList();
        return new NotificationsDto(true, unread, items);
    }

    private static Task<List<NotificationDto>> ToDtos(IQueryable<Notification> query, int take) =>
        query
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Message, n.Context, n.ProjectId, n.ActivityId, n.CreatedAt,
                n.ReadAt != null))
            .ToListAsync();

    public async Task MarkReadAsync(Guid id)
    {
        var volunteerId = await MyVolunteerIdAsync();
        await _db.Notifications
            .Where(n => n.Id == id && n.VolunteerId == volunteerId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
    }

    public async Task MarkAllReadAsync()
    {
        var volunteerId = await MyVolunteerIdAsync();
        await _db.Notifications
            .Where(n => n.VolunteerId == volunteerId && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
    }

    // ---------- internos ----------

    /// <summary>Lembrete de prazo so aparece enquanto a atividade existe e continua em aberto.</summary>
    private IQueryable<Notification> Visible(Guid volunteerId) =>
        _db.Notifications.AsNoTracking().Where(n => n.VolunteerId == volunteerId
            && (!DueTypes.Contains(n.Type) || (n.Activity != null && n.Activity.Status != ActivityStatus.Concluida)));

    /// <summary>Gera (uma vez so) os lembretes das atividades da pessoa que vencem hoje ou amanha.</summary>
    private async Task EnsureDueRemindersAsync(Guid volunteerId)
    {
        var today = Mapping.Today;
        var tomorrow = today.AddDays(1);

        var due = await _db.Activities
            .AsNoTracking()
            .Where(a => a.AssignedVolunteerId == volunteerId
                        && a.Status != ActivityStatus.Concluida
                        && (a.DueDate == today || a.DueDate == tomorrow)
                        && !a.Project!.IsArchived
                        && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento))
            .Select(a => new { a.Id, a.Title, a.DueDate, a.ProjectId, ProjectName = a.Project!.Name })
            .ToListAsync();
        if (due.Count == 0) return;

        string KeyFor(Guid activityId, DateOnly date) => $"due:{activityId:N}:{date:yyyy-MM-dd}:{(date == today ? "hoje" : "amanha")}";

        var keys = due.Select(a => KeyFor(a.Id, a.DueDate!.Value)).ToList();
        var existing = await _db.Notifications
            .Where(n => n.VolunteerId == volunteerId && n.Key != null && keys.Contains(n.Key))
            .Select(n => n.Key!)
            .ToListAsync();

        foreach (var activity in due)
        {
            var key = KeyFor(activity.Id, activity.DueDate!.Value);
            if (existing.Contains(key)) continue;

            var isToday = activity.DueDate == today;
            _db.Notifications.Add(new Notification
            {
                VolunteerId = volunteerId,
                Type = isToday ? NotificationType.ActivityDueToday : NotificationType.ActivityDueTomorrow,
                Message = $"\"{activity.Title}\" vence {(isToday ? "hoje" : "amanhã")}",
                Context = activity.ProjectName,
                ProjectId = activity.ProjectId,
                ActivityId = activity.Id,
                Key = key,
                CreatedAt = DateTime.UtcNow
            });
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Duas consultas ao mesmo tempo (o sininho e a lista) tentaram criar o mesmo lembrete: o indice unico
            // segura a duplicata e o que ja foi gravado vale.
            _db.ChangeTracker.Clear();
        }
    }

    private async Task AddAsync(Guid recipientVolunteerId, NotificationType type, string message, Guid projectId,
        Guid? activityId, string? context)
    {
        var actor = await GetActorAsync();
        if (actor.VolunteerId == recipientVolunteerId) return;

        _db.Notifications.Add(new Notification
        {
            VolunteerId = recipientVolunteerId,
            Type = type,
            Message = Truncate(message, 400),
            Context = context is null ? null : Truncate(context, 200),
            ProjectId = projectId,
            ActivityId = activityId,
            ActorUserId = actor.UserId,
            CreatedAt = DateTime.UtcNow
        });
    }

    private async Task<Actor> GetActorAsync()
    {
        if (_actor is not null) return _actor;

        var userId = _currentUser.Id;
        var user = userId.HasValue
            ? await _db.Users.AsNoTracking().Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Id == userId.Value)
            : null;

        // Nome curto, como no topo da tela: so o primeiro nome.
        var name = (Mapping.PersonName(user) ?? "Alguém").Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "Alguém";
        return _actor = new Actor(user?.Id, user?.VolunteerId, name);
    }

    private async Task<Guid?> MyVolunteerIdAsync()
    {
        var userId = _currentUser.RequireId();
        return await _db.Users.Where(u => u.Id == userId).Select(u => u.VolunteerId).FirstOrDefaultAsync();
    }

    private async Task<string?> ProjectNameAsync(Guid projectId) =>
        _db.Projects.Local.FirstOrDefault(p => p.Id == projectId)?.Name
        ?? await _db.Projects.Where(p => p.Id == projectId).Select(p => p.Name).FirstOrDefaultAsync();

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..(max - 1)] + "…";
}
