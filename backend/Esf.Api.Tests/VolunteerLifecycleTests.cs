using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Entrada e saida do voluntario no nucleo.</summary>
public class VolunteerLifecycleTests
{
    private static VolunteerService Service(EsfDbContext db, TestUser user) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())), new NotificationService(db, user), user);

    private static SaveVolunteerRequest Request(string name, VolunteerStatus status = VolunteerStatus.Ativo) => new()
    {
        Name = name,
        Email = $"{name.Replace(' ', '.').ToLowerInvariant()}@teste.org",
        Sector = VolunteerSector.Projetos,
        Status = status
    };

    [Fact]
    public async Task NewVolunteerStartsOnTheDayTheyJoinedTheNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = Service(db, f.A.Admin);
        var joined = Mapping.Today.AddDays(-70);

        var request = Request("Pessoa Antiga");
        request.ActiveSince = joined;
        var created = await volunteers.CreateAsync(request);

        // O historico (e as horas) comeca no dia da entrada, nao no do cadastro: 71 dias como ativo = 60 horas.
        var start = await db.VolunteerStatusChanges.Where(c => c.VolunteerId == created.Id).MinAsync(c => c.StartsOn);
        Assert.Equal(joined, start);
        Assert.Equal(60, (await new VolunteerStatusHistoryService(db, f.A.Admin).GetAsync(created.Id)).Hours);

        // Sem a data, hoje; depois de hoje, nao.
        var today = await volunteers.CreateAsync(Request("Pessoa Nova"));
        Assert.Equal(Mapping.Today,
            await db.VolunteerStatusChanges.Where(c => c.VolunteerId == today.Id).MinAsync(c => c.StartsOn));
        var future = Request("Pessoa Futura");
        future.ActiveSince = Mapping.Today.AddDays(1);
        await Assert.ThrowsAsync<AppException>(() => volunteers.CreateAsync(future));
    }

    [Fact]
    public async Task LeavingTheNucleoCanDeactivateTheAccessAndReleaseTheTasks()
    {
        var f = await TwoNucleos.CreateAsync();
        var coordinator = new TestUser { Id = Guid.NewGuid(), Name = "Coord", Role = UserRole.Coordenador, OrganizationId = f.A.OrganizationId };
        Guid userId;
        await using (var system = f.SystemContext())
        {
            var user = new Domain.Entities.User
            {
                OrganizationId = f.A.OrganizationId, Name = "Sem acesso a", Email = "sem.acesso.a@teste.org",
                PasswordHash = "x", Role = UserRole.Usuario, VolunteerId = f.A.VolunteerWithoutAccessId
            };
            system.Users.Add(user);
            system.Activities.Add(new Domain.Entities.Activity
            {
                ProjectId = f.A.ProjectId, Title = "Comprar material", Status = ActivityStatus.EmAndamento,
                Priority = ActivityPriority.Media, AssignedVolunteerId = f.A.VolunteerWithoutAccessId
            });
            await system.SaveChangesAsync();
            userId = user.Id;
        }

        await using var db = f.Context(coordinator);
        var volunteers = Service(db, coordinator);

        // Afastado nao mexe em nada, mesmo com as caixinhas marcadas.
        var away = Request("Sem acesso a", VolunteerStatus.Afastado);
        away.DeactivateAccess = true;
        away.ReleaseTasks = true;
        await volunteers.UpdateAsync(f.A.VolunteerWithoutAccessId, away);
        Assert.True((await db.Users.SingleAsync(u => u.Id == userId)).IsActive);

        // Ex-membro: acesso desativado e a tarefa sem responsavel.
        var leaving = Request("Sem acesso a", VolunteerStatus.ExMembro);
        leaving.DeactivateAccess = true;
        leaving.ReleaseTasks = true;
        await volunteers.UpdateAsync(f.A.VolunteerWithoutAccessId, leaving);
        Assert.False((await db.Users.SingleAsync(u => u.Id == userId)).IsActive);
        Assert.Empty(await db.Activities.Where(a => a.AssignedVolunteerId == f.A.VolunteerWithoutAccessId).ToListAsync());
        Assert.Single(await db.Activities.Where(a => a.Title == "Comprar material" && a.AssignedVolunteerId == null).ToListAsync());

        // O acesso de um administrador, o coordenador nao desativa.
        var admin = Request("Voluntario a", VolunteerStatus.Inativo);
        admin.DeactivateAccess = true;
        await Assert.ThrowsAsync<AppException>(() => volunteers.UpdateAsync(f.A.VolunteerId, admin));
    }
}
