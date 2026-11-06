using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;

namespace Esf.Api.Tests;

/// <summary>Inicio da coordenacao: os numeros da organizacao e quem esta sem tarefa.</summary>
public class DashboardTests
{
    [Fact]
    public async Task IdleListsActiveVolunteersWithoutOpenTasks()
    {
        var f = await TwoNucleos.CreateAsync();
        Guid inTeamId;
        await using (var db = f.SystemContext())
        {
            var inTeam = new Volunteer { OrganizationId = f.A.OrganizationId, Name = "Ana na equipe" };
            var away = new Volunteer { OrganizationId = f.A.OrganizationId, Name = "Afastado", Status = VolunteerStatus.Afastado };
            var anonymized = new Volunteer { OrganizationId = f.A.OrganizationId, Name = "Voluntario anonimizado", AnonymizedAt = DateTime.UtcNow };
            // Tarefa concluida nao conta: a pessoa continua sem tarefa em aberto.
            var done = new Activity { ProjectId = f.A.ProjectId, Title = "Feita", Status = ActivityStatus.Concluida, AssignedVolunteerId = inTeam.Id };
            db.AddRange(inTeam, away, anonymized, done,
                new ProjectVolunteer { ProjectId = f.A.ProjectId, VolunteerId = inTeam.Id });
            await db.SaveChangesAsync();
            inTeamId = inTeam.Id;
        }

        await using var context = f.Context(f.A.Admin);
        var dashboard = await new DashboardService(context).GetAsync(f.A.AdminUserId);

        // Quem tem tarefa em aberto (o voluntario do admin) fica de fora; sem projeto vem antes de quem esta em um.
        Assert.Equal(new[] { f.A.VolunteerWithoutAccessId, inTeamId }, dashboard.Idle.Select(v => v.VolunteerId));
        Assert.Equal(new[] { 0, 1 }, dashboard.Idle.Select(v => v.Projects));

        Assert.Equal(1, dashboard.Org.LateTasks);
        Assert.Equal(0, dashboard.Org.BlockedTasks);
    }
}
