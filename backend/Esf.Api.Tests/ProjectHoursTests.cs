using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Horas por projeto: cada um lanca as proprias (so estando na equipe), a coordenacao lanca e corrige as de qualquer um,
/// o registro de andamento pode levar as horas do dia e cada nucleo so ve as do proprio.
/// </summary>
public class ProjectHoursTests
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3));

    /// <summary>Acesso de perfil Usuario para o voluntario "Sem acesso" (opcionalmente ja na equipe do projeto).</summary>
    private static async Task<TestUser> MemberLoginAsync(TwoNucleos f, Nucleo nucleo, bool inTeam = true)
    {
        await using var db = f.SystemContext();
        var user = new User
        {
            OrganizationId = nucleo.OrganizationId,
            Name = "Sem acesso",
            Email = $"membro.{Guid.NewGuid():N}@teste.org",
            Role = UserRole.Usuario,
            VolunteerId = nucleo.VolunteerWithoutAccessId
        };
        db.Users.Add(user);
        if (inTeam) db.ProjectVolunteers.Add(new ProjectVolunteer { ProjectId = nucleo.ProjectId, VolunteerId = nucleo.VolunteerWithoutAccessId });
        await db.SaveChangesAsync();
        return new TestUser { Id = user.Id, Name = user.Name, Role = UserRole.Usuario, OrganizationId = nucleo.OrganizationId };
    }

    private static SaveHourEntryRequest Entry(decimal hours, Guid? volunteerId = null, int daysAgo = 1, string? what = "Visita") =>
        new() { VolunteerId = volunteerId, Date = Today.AddDays(-daysAgo), Hours = hours, Description = what };

    [Fact]
    public async Task MemberLogsOwnHoursAndCoordinationSeesThem()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);

        await using (var db = f.Context(member))
        {
            var created = await new ProjectHoursService(db, member).CreateAsync(f.A.ProjectId, Entry(2.5m));
            Assert.Equal(f.A.VolunteerWithoutAccessId, created.VolunteerId);
            Assert.True(created.CanEdit);
        }

        await using (var db = f.Context(f.A.Admin))
        {
            var service = new ProjectHoursService(db, f.A.Admin);
            await service.CreateAsync(f.A.ProjectId, Entry(4, f.A.VolunteerId, what: "Projeto"));

            var list = await service.ListAsync(f.A.ProjectId);
            Assert.Equal(6.5m, list.Total);
            Assert.Equal(2, list.People.Count);
            Assert.Equal(4, list.People[0].Hours);
            Assert.All(list.Entries, e => Assert.True(e.CanEdit));
        }

        await using (var db = f.Context(member))
        {
            var list = await new ProjectHoursService(db, member).ListAsync(f.A.ProjectId);
            Assert.True(list.Entries.Single(e => e.VolunteerId == f.A.VolunteerWithoutAccessId).CanEdit);
            Assert.False(list.Entries.Single(e => e.VolunteerId == f.A.VolunteerId).CanEdit);
        }
    }

    [Fact]
    public async Task MemberCannotLogOrChangeSomeoneElsesHours()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);
        Guid adminEntry;
        await using (var db = f.Context(f.A.Admin))
            adminEntry = (await new ProjectHoursService(db, f.A.Admin).CreateAsync(f.A.ProjectId, Entry(3, f.A.VolunteerId))).Id;

        await using var memberDb = f.Context(member);
        var service = new ProjectHoursService(memberDb, member);

        var forOther = await Assert.ThrowsAsync<AppException>(() => service.CreateAsync(f.A.ProjectId, Entry(1, f.A.VolunteerId)));
        Assert.Equal(403, forOther.StatusCode);
        var edit = await Assert.ThrowsAsync<AppException>(() => service.UpdateAsync(adminEntry, Entry(1)));
        Assert.Equal(403, edit.StatusCode);
        await Assert.ThrowsAsync<AppException>(() => service.DeleteAsync(adminEntry));
    }

    [Fact]
    public async Task OnlyTeamMembersHaveHours()
    {
        var f = await TwoNucleos.CreateAsync();
        var outsider = await MemberLoginAsync(f, f.A, inTeam: false);
        await using var db = f.Context(outsider);

        var error = await Assert.ThrowsAsync<AppException>(() =>
            new ProjectHoursService(db, outsider).CreateAsync(f.A.ProjectId, Entry(2)));

        Assert.Contains("não está na equipe", error.Message);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(25, 1)]
    [InlineData(2, -1)]
    public async Task InvalidHoursOrDateAreRefused(decimal hours, int daysAgo)
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        await Assert.ThrowsAsync<AppException>(() =>
            new ProjectHoursService(db, f.A.Admin).CreateAsync(f.A.ProjectId, Entry(hours, f.A.VolunteerId, daysAgo)));
    }

    [Fact]
    public async Task CoordinationCorrectsAndRemovesEntries()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);
        Guid id;
        await using (var db = f.Context(member))
            id = (await new ProjectHoursService(db, member).CreateAsync(f.A.ProjectId, Entry(8))).Id;

        await using (var db = f.Context(f.A.Admin))
        {
            var service = new ProjectHoursService(db, f.A.Admin);
            var fixedEntry = await service.UpdateAsync(id, Entry(5, what: "Visita e relatório"));
            Assert.Equal(5, fixedEntry.Hours);
            Assert.Equal("Visita e relatório", fixedEntry.Description);

            await service.DeleteAsync(id);
            Assert.Equal(0, (await service.ListAsync(f.A.ProjectId)).Total);
        }
    }

    [Fact]
    public async Task ProgressRecordCanCarryTheHoursOfTheDay()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);
        await using var db = f.Context(member);
        var updates = new ProjectUpdateService(db, new FileStorageService(db, Options.Create(new StorageOptions())), member);

        await updates.CreateAsync(f.A.ProjectId,
            new CreateProjectUpdateRequest { Text = "<p>Levantamento das medidas do banheiro</p>", Hours = 3 }, member.Id);

        var entry = await db.ProjectHourEntries.SingleAsync(h => h.ProjectId == f.A.ProjectId);
        Assert.Equal(f.A.VolunteerWithoutAccessId, entry.VolunteerId);
        Assert.Equal(3, entry.Hours);
        Assert.Equal(Today, entry.Date);
        Assert.Equal("Levantamento das medidas do banheiro", entry.Description);
    }

    [Fact]
    public async Task EachNucleoSeesOnlyItsOwnHours()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.Context(f.A.Admin))
            await new ProjectHoursService(db, f.A.Admin).CreateAsync(f.A.ProjectId, Entry(3, f.A.VolunteerId));

        await using var other = f.Context(f.B.Admin);
        var service = new ProjectHoursService(other, f.B.Admin);

        await Assert.ThrowsAsync<AppException>(() => service.ListAsync(f.A.ProjectId));
        Assert.Empty(await other.ProjectHourEntries.ToListAsync());
        Assert.Empty(await ProjectHoursService.TotalsAsync(other, new[] { f.A.ProjectId }, null, null));
    }

    [Fact]
    public async Task ReportTotalsFollowThePeriod()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var service = new ProjectHoursService(db, f.A.Admin);
        await service.CreateAsync(f.A.ProjectId, Entry(2, f.A.VolunteerId, daysAgo: 40));
        await service.CreateAsync(f.A.ProjectId, Entry(3, f.A.VolunteerId, daysAgo: 5));

        var all = await ProjectHoursService.TotalsAsync(db, new[] { f.A.ProjectId }, null, null);
        var recent = await ProjectHoursService.TotalsAsync(db, new[] { f.A.ProjectId }, Today.AddDays(-30), Today);

        Assert.Equal(5, all[f.A.ProjectId][f.A.VolunteerId]);
        Assert.Equal(3, recent[f.A.ProjectId][f.A.VolunteerId]);
    }
}
