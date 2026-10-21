using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class DashboardService
{
    /// <summary>Projeto em andamento sem relato ha mais que isso aparece como "parado".</summary>
    public const int StaleDays = 30;

    private const int WorkloadLimit = 6;

    /// <summary>Limite de "Minhas tarefas" (a tela agrupa por prazo e mostra as primeiras).</summary>
    private const int MyTasksLimit = 50;

    private readonly EsfDbContext _db;

    public DashboardService(EsfDbContext db) => _db = db;

    public async Task<DashboardDto> GetAsync(Guid? currentUserId)
    {
        var today = Mapping.Today;

        // Tarefas em aberto de projetos que estao acontecendo (planejamento ou andamento, nao arquivados).
        // O volume de uma organizacao como esta e pequeno, entao o resto e calculado em memoria.
        var open = await _db.Activities
            .AsNoTracking()
            .Include(a => a.Project).ThenInclude(p => p!.Program)
            .Include(a => a.AssignedVolunteer)
            .Where(a => a.Status != ActivityStatus.Concluida
                        && !a.Project!.IsArchived
                        && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento))
            .ToListAsync();

        bool IsLate(Activity a) => a.DueDate.HasValue && a.DueDate.Value < today;
        bool IsBlocked(Activity a) => a.Status == ActivityStatus.Bloqueada;

        // Agrupa pelo Id: sem rastreamento, cada tarefa traz sua propria instancia do voluntario.
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

        var staleSince = DateTime.UtcNow.AddDays(-StaleDays);
        var staleProjects = await StaleProjectsQuery(_db, staleSince).CountAsync();

        var org = new OrgSummaryDto(
            open.Count(IsLate),
            open.Count(IsBlocked),
            open.Count(a => a.AssignedVolunteerId == null),
            staleProjects);

        MyActivitiesDto? mine = null;
        var myTasks = new List<ActivityDto>();
        var myProjects = new List<HomeProjectDto>();
        var myVolunteerId = currentUserId.HasValue
            ? await _db.Users.Where(u => u.Id == currentUserId.Value).Select(u => u.VolunteerId).FirstOrDefaultAsync()
            : null;

        if (myVolunteerId.HasValue)
        {
            var volunteerId = myVolunteerId.Value;
            var myOpen = open.Where(a => a.AssignedVolunteerId == volunteerId).ToList();
            mine = new MyActivitiesDto(myOpen.Count, myOpen.Count(IsLate), myOpen.Count(IsBlocked));

            var tasks = myOpen
                .OrderBy(a => a.DueDate ?? DateOnly.MaxValue)
                .ThenByDescending(a => a.Priority)
                .ThenBy(a => a.Title)
                .Take(MyTasksLimit)
                .ToList();
            var counts = await ActivityCounts.ForAsync(_db, tasks.Select(a => a.Id).ToList());
            myTasks = tasks.Select(a => Mapping.ToDto(a, counts.GetValueOrDefault(a.Id))).ToList();

            var projects = await _db.Projects
                .AsNoTracking()
                .Where(p => !p.IsArchived
                            && (p.Status == ProjectStatus.Planejamento || p.Status == ProjectStatus.EmAndamento)
                            && (p.OwnerVolunteerId == volunteerId || p.Volunteers.Any(v => v.VolunteerId == volunteerId)))
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Program!.Icon,
                    p.Program.Color,
                    p.Status,
                    Total = p.Activities.Count,
                    Done = p.Activities.Count(a => a.Status == ActivityStatus.Concluida),
                    LastUpdateAt = p.Updates.Max(u => (DateTime?)u.CreatedAt)
                })
                .ToListAsync();

            myProjects = projects
                .Select(p => new HomeProjectDto(p.Id, p.Name, p.Icon, p.Color, p.Status,
                    Mapping.ProjectProgress(p.Status, p.Total, p.Done), p.LastUpdateAt))
                .ToList();
        }

        return new DashboardDto(mine, myTasks, myProjects, org, workload);
    }

    /// <summary>
    /// Projetos parados: em andamento, nao arquivados, criados ha mais de 30 dias e sem relato desde entao
    /// (o ultimo relato, ou a criacao quando nunca houve um, e anterior ao corte).
    /// </summary>
    public static IQueryable<Project> StaleProjectsQuery(EsfDbContext db, DateTime since) =>
        db.Projects.AsNoTracking().Where(p =>
            p.Status == ProjectStatus.EmAndamento
            && !p.IsArchived
            && p.CreatedAt < since
            && (p.Updates.Max(u => (DateTime?)u.CreatedAt) ?? p.CreatedAt) < since);
}
