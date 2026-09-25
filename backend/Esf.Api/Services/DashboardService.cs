using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class DashboardService
{
    private readonly EsfDbContext _db;
    private readonly ProjectService _projects;
    private readonly ActivityService _activities;

    public DashboardService(EsfDbContext db, ProjectService projects, ActivityService activities)
    {
        _db = db;
        _projects = projects;
        _activities = activities;
    }

    public async Task<DashboardDto> GetAsync()
    {
        var today = Mapping.Today;
        var active = _db.Projects.AsNoTracking().Where(p => !p.IsArchived);

        var total = await active.CountAsync();
        var inProgress = await active.CountAsync(p => p.Status == ProjectStatus.EmAndamento);
        var planning = await active.CountAsync(p => p.Status == ProjectStatus.Planejamento);
        var completed = await active.CountAsync(p => p.Status == ProjectStatus.Concluido);
        var late = await active.CountAsync(p => p.EndDateForecast != null
                                                && p.EndDateForecast < today
                                                && p.Status != ProjectStatus.Concluido
                                                && p.Status != ProjectStatus.Cancelado);

        var pendingActivities = await _db.Activities.AsNoTracking()
            .CountAsync(a => a.Status != ActivityStatus.Concluida && !a.Project!.IsArchived);

        var volunteersInProjects = await _db.ProjectVolunteers.AsNoTracking()
            .Where(pv => !pv.Project!.IsArchived)
            .Select(pv => pv.VolunteerId)
            .Distinct()
            .CountAsync();

        var byStatus = await active
            .GroupBy(p => p.Status)
            .Select(g => new StatusCountDto(g.Key, g.Count()))
            .ToListAsync();

        var indicatorGroups = await _db.Indicators.AsNoTracking()
            .Where(i => !i.Project!.IsArchived)
            .GroupBy(i => new { i.Name, i.Unit })
            .Select(g => new
            {
                g.Key.Name,
                g.Key.Unit,
                Value = g.Sum(x => x.Value)
            })
            .ToListAsync();

        var topIndicators = indicatorGroups
            .OrderByDescending(g => g.Value)
            .Take(6)
            .Select(g => new IndicatorSummaryDto(g.Name, g.Unit, g.Value))
            .ToList();

        var activeProjects = (await _projects.ListAsync(new ProjectQuery { Sort = "recent" }))
            .Where(p => p.Status == ProjectStatus.EmAndamento || p.Status == ProjectStatus.Planejamento)
            .Take(6)
            .ToList();

        if (activeProjects.Count == 0)
            activeProjects = (await _projects.ListAsync(new ProjectQuery { Sort = "recent" })).Take(6).ToList();

        var upcoming = await _activities.ListUpcomingAsync(6);

        var totals = new ProjectTotalsDto(total, inProgress, planning, completed, late,
            pendingActivities, volunteersInProjects);

        return new DashboardDto(totals, byStatus, topIndicators, activeProjects, upcoming);
    }
}
