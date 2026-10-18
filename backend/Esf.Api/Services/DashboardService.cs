using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class DashboardService
{
    /// <summary>Janela do numero "concluidas no mes", em dias.</summary>
    private const int CompletedWindowDays = 30;

    /// <summary>Limite de itens devolvidos em "precisa de atencao" (a tela mostra os primeiros e expande).</summary>
    private const int AttentionLimit = 50;

    private const int WorkloadLimit = 6;

    /// <summary>Quantas atividades aparecem em "Minhas atividades".</summary>
    private const int MyUpcomingLimit = 6;

    private readonly EsfDbContext _db;

    public DashboardService(EsfDbContext db) => _db = db;

    public async Task<DashboardDto> GetAsync(Guid? currentUserId)
    {
        var today = Mapping.Today;

        // Atividades em aberto de projetos que estao acontecendo (planejamento ou andamento, nao arquivados).
        // O volume de uma organizacao como esta e pequeno, entao o resto e calculado em memoria.
        var open = await _db.Activities
            .AsNoTracking()
            .Include(a => a.Project)
            .Include(a => a.AssignedVolunteer)
            .Where(a => a.Status != ActivityStatus.Concluida
                        && !a.Project!.IsArchived
                        && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento))
            .ToListAsync();

        bool IsLate(Activity a) => a.DueDate.HasValue && a.DueDate.Value < today;
        bool IsBlocked(Activity a) => a.Status == ActivityStatus.Bloqueada;

        // Mais urgente primeiro: atrasadas (as mais antigas antes), depois bloqueadas, depois sem responsavel.
        int Urgency(Activity a) => IsLate(a) ? 0 : IsBlocked(a) ? 1 : 2;
        var attention = open
            .Where(a => IsLate(a) || IsBlocked(a) || a.AssignedVolunteerId == null)
            .OrderBy(Urgency)
            .ThenBy(a => a.DueDate ?? DateOnly.MaxValue)
            .ThenByDescending(a => a.Priority)
            .ThenBy(a => a.Title)
            .Take(AttentionLimit)
            .Select(Mapping.ToDto)
            .ToList();

        // Agrupa pelo Id: sem rastreamento, cada atividade traz sua propria instancia do voluntario.
        var workload = open
            .Where(a => a.AssignedVolunteer is not null)
            .GroupBy(a => a.AssignedVolunteerId!.Value)
            .Select(g => new VolunteerWorkloadDto(
                g.Key,
                g.First().AssignedVolunteer!.Name,
                Mapping.PhotoUrl(g.First().AssignedVolunteer!.PhotoStoredName),
                g.Count(),
                g.Count(IsLate)))
            .OrderByDescending(w => w.OpenActivities)
            .ThenByDescending(w => w.LateActivities)
            .ThenBy(w => w.Name)
            .Take(WorkloadLimit)
            .ToList();

        var busyVolunteers = open
            .Where(a => a.AssignedVolunteerId.HasValue)
            .Select(a => a.AssignedVolunteerId!.Value)
            .ToHashSet();

        var activeVolunteerIds = await _db.Volunteers
            .AsNoTracking()
            .Where(v => v.Status == VolunteerStatus.Ativo)
            .Select(v => v.Id)
            .ToListAsync();

        var completedSince = DateTime.UtcNow.AddDays(-CompletedWindowDays);
        var completedRecently = await _db.Activities
            .AsNoTracking()
            .CountAsync(a => a.Status == ActivityStatus.Concluida
                             && a.CompletedAt >= completedSince
                             && !a.Project!.IsArchived);

        var totals = new DashboardTotalsDto(
            open.Count(IsLate),
            open.Count(IsBlocked),
            completedRecently,
            open.Count(a => a.Status == ActivityStatus.EmAndamento),
            activeVolunteerIds.Count,
            activeVolunteerIds.Count(id => !busyVolunteers.Contains(id)));

        MyActivitiesDto? mine = null;
        var myUpcoming = new List<ActivityDto>();
        if (currentUserId.HasValue)
        {
            var myVolunteerId = await _db.Users
                .Where(u => u.Id == currentUserId.Value)
                .Select(u => u.VolunteerId)
                .FirstOrDefaultAsync();

            if (myVolunteerId.HasValue)
            {
                var myOpen = open.Where(a => a.AssignedVolunteerId == myVolunteerId.Value).ToList();
                mine = new MyActivitiesDto(myOpen.Count, myOpen.Count(IsLate), myOpen.Count(IsBlocked));
                myUpcoming = myOpen
                    .OrderBy(a => a.DueDate ?? DateOnly.MaxValue)
                    .ThenByDescending(a => a.Priority)
                    .ThenBy(a => a.Title)
                    .Take(MyUpcomingLimit)
                    .Select(Mapping.ToDto)
                    .ToList();
            }
        }

        return new DashboardDto(totals, attention, workload, mine, myUpcoming);
    }
}
