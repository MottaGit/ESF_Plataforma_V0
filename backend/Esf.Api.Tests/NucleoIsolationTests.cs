using System.IdentityModel.Tokens.Jwt;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Separacao entre nucleos: quem e de um nucleo nao le, nao cria e nao referencia dados de outro. Se um teste daqui
/// falhar, dados pessoais de um nucleo podem estar aparecendo para outro.
/// </summary>
public class NucleoIsolationTests
{
    private static readonly DateOnly Today = Mapping.Today;

    private static JwtTokenService Jwt() => new(Options.Create(new JwtOptions
    {
        Key = new string('k', 40),
        Issuer = "teste",
        Audience = "teste",
        ExpiresMinutes = 60
    }));

    private static FileStorageService Storage(Data.EsfDbContext db) => new(db, Options.Create(new StorageOptions()));

    [Fact]
    public async Task EachTableShowsOnlyTheCurrentNucleo()
    {
        var f = await TwoNucleos.CreateAsync();

        foreach (var (mine, other) in new[] { (f.A, f.B), (f.B, f.A) })
        {
            await using var db = f.Context(mine.Admin);

            Assert.Equal(mine.OrganizationId, Assert.Single(await db.Organizations.ToListAsync()).Id);
            Assert.Equal(mine.AdminUserId, Assert.Single(await db.Users.ToListAsync()).Id);
            Assert.All(await db.Volunteers.ToListAsync(), v => Assert.Equal(mine.OrganizationId, v.OrganizationId));
            Assert.Equal(2, await db.Volunteers.CountAsync());
            Assert.Equal(mine.ProgramId, Assert.Single(await db.Programs.ToListAsync()).Id);
            Assert.Equal(mine.ProjectId, Assert.Single(await db.Projects.ToListAsync()).Id);
            Assert.Equal(mine.ActivityId, Assert.Single(await db.Activities.ToListAsync()).Id);

            Assert.Equal(mine.ProjectId, Assert.Single(await db.Indicators.ToListAsync()).ProjectId);
            Assert.Equal(mine.ProjectId, Assert.Single(await db.ProjectUpdates.ToListAsync()).ProjectId);
            Assert.Equal(mine.ProjectId, Assert.Single(await db.ProjectFiles.ToListAsync()).ProjectId);
            Assert.Equal(mine.ProjectId, Assert.Single(await db.ProjectVolunteers.ToListAsync()).ProjectId);
            Assert.Equal(mine.ActivityId, Assert.Single(await db.ActivityChecklistItems.ToListAsync()).ActivityId);
            Assert.Equal(mine.ActivityId, Assert.Single(await db.ActivityComments.ToListAsync()).ActivityId);
            Assert.Equal(mine.VolunteerId, Assert.Single(await db.VolunteerStatusChanges.ToListAsync()).VolunteerId);
            Assert.Equal(mine.VolunteerId, Assert.Single(await db.Notifications.ToListAsync()).VolunteerId);
            Assert.Equal(2, await db.SignedDocuments.CountAsync());
            Assert.Equal(mine.ProgramId, Assert.Single(await db.ProgramTemplateActivities.ToListAsync()).ProgramId);
            Assert.Equal(mine.ProgramId, Assert.Single(await db.ProgramTemplateIndicators.ToListAsync()).ProgramId);
            Assert.Equal(mine.ProgramId, Assert.Single(await db.ProgramPartners.ToListAsync()).ProgramId);
            Assert.Equal(mine.OrganizationId, Assert.Single(await db.AuditEntries.ToListAsync()).OrganizationId);
            Assert.Equal(mine.AdminUserId, Assert.Single(await db.AccessLinks.ToListAsync()).UserId);

            Assert.False(await db.Projects.AnyAsync(p => p.Id == other.ProjectId));
            Assert.False(await db.Volunteers.AnyAsync(v => v.Id == other.VolunteerId));
        }
    }

    [Fact]
    public async Task LookingUpAnIdFromAnotherNucleoFindsNothing()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        Assert.Null(await db.Projects.FindAsync(f.B.ProjectId));
        Assert.Null(await db.Volunteers.FindAsync(f.B.VolunteerId));
        Assert.Null(await db.Activities.FirstOrDefaultAsync(a => a.Id == f.B.ActivityId));
        // Incluindo pelo relacionamento tambem nao traz nada do outro nucleo.
        Assert.Empty(await db.Projects.Where(p => p.Id == f.B.ProjectId).Include(p => p.Activities).ToListAsync());
    }

    [Fact]
    public async Task NewRecordsGoToTheCurrentNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.B.Admin);

        var volunteer = new Volunteer { Name = "Pessoa nova" };
        var program = new ProjectProgram { Name = "Hortas" };
        db.AddRange(volunteer, program);
        await db.SaveChangesAsync();

        Assert.Equal(f.B.OrganizationId, volunteer.OrganizationId);
        Assert.Equal(f.B.OrganizationId, program.OrganizationId);
    }

    [Fact]
    public async Task WithoutNucleoNothingCanBeCreatedNorSeen()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(TestUser.Anonymous);

        Assert.Empty(await db.Projects.ToListAsync());
        Assert.Empty(await db.Volunteers.ToListAsync());

        db.Volunteers.Add(new Volunteer { Name = "Sem nucleo" });
        var error = await Assert.ThrowsAsync<AppException>(() => db.SaveChangesAsync());
        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public async Task ServicesRefuseIdsFromAnotherNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var notifications = new NotificationService(db, f.A.Admin);
        var activities = new ActivityService(db, notifications, new ActivityCommentService(db, f.A.Admin, notifications));
        var volunteers = new VolunteerService(db, Storage(db), notifications);
        var projects = new ProjectService(db, notifications);

        var task = new SaveActivityRequest { Title = "Tarefa nova", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media };
        // Tarefa num projeto de outro nucleo.
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.B.ProjectId, task));
        // Responsavel de outro nucleo numa tarefa do proprio.
        task.AssignedVolunteerId = f.B.VolunteerId;
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.A.ProjectId, task));
        // Projeto num programa de outro nucleo.
        await Assert.ThrowsAsync<AppException>(() => projects.CreateAsync(new SaveProjectRequest
        {
            Name = "Projeto novo", ProgramId = f.B.ProgramId, StartDate = Today, Status = ProjectStatus.Planejamento
        }));
        // Voluntario de outro nucleo na equipe; ficha de voluntario de outro nucleo.
        await Assert.ThrowsAsync<AppException>(() => volunteers.AddToProjectAsync(f.A.ProjectId,
            new AddProjectVolunteerRequest { VolunteerId = f.B.VolunteerId }));
        await Assert.ThrowsAsync<AppException>(() => volunteers.GetAsync(f.B.VolunteerId));
    }

    [Fact]
    public async Task LoginFindsAnyNucleoAndTheTokenCarriesIt()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(TestUser.Anonymous);

        var result = await new AuthService(db, Jwt())
            .LoginAsync(new LoginRequest { Email = f.B.AdminEmail, Password = TwoNucleos.Password });

        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        Assert.Equal(f.B.OrganizationId.ToString(), token.Claims.Single(c => c.Type == CurrentUser.OrganizationClaim).Value);
    }

    [Fact]
    public async Task AccessIsGrantedOnlyToVolunteersOfTheSameNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var access = new AccessService(db, Jwt(), f.A.Admin);

        await Assert.ThrowsAsync<AppException>(() => access.GrantAsync(f.B.VolunteerWithoutAccessId, UserRole.Usuario));
        var link = await access.GrantAsync(f.A.VolunteerWithoutAccessId, UserRole.Usuario);

        // O link e usado sem login (rota publica) e a pessoa entra no nucleo do voluntario.
        await using var publicDb = f.Context(TestUser.Anonymous);
        var login = await new AccessService(publicDb, Jwt(), TestUser.Anonymous)
            .UseAsync(link.Token, new UseAccessLinkRequest { Password = "Nova@123", AcceptTerms = true });
        var token = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Equal(f.A.OrganizationId.ToString(), token.Claims.Single(c => c.Type == CurrentUser.OrganizationClaim).Value);
    }

    [Fact]
    public async Task EmailIsUniqueAcrossNucleos()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var system = f.SystemContext())
        {
            var volunteer = await system.Volunteers.SingleAsync(v => v.Id == f.B.VolunteerWithoutAccessId);
            volunteer.Email = f.A.AdminEmail;
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.B.Admin);
        var error = await Assert.ThrowsAsync<AppException>(() =>
            new AccessService(db, Jwt(), f.B.Admin).GrantAsync(f.B.VolunteerWithoutAccessId, UserRole.Usuario));
        Assert.Equal(409, error.StatusCode);
    }

    [Fact]
    public async Task ScreensOfTheNucleoUseOnlyItsData()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        Assert.All(await new UserService(db).ListAsync(), u => Assert.Equal(f.A.AdminUserId, u.Id));
        Assert.Equal("Nucleo A", (await new OrganizationService(db, Storage(db)).GetAsync()).Name);
        Assert.Equal(2, (await new VolunteerService(db, Storage(db), new NotificationService(db, f.A.Admin)).ListAsync(null, false, null)).Count);

        // Inicio: so a tarefa atrasada do proprio nucleo conta.
        var dashboard = await new DashboardService(db).GetAsync(f.A.AdminUserId);
        Assert.Equal(1, dashboard.Org.LateTasks);

        // Relatorio com projeto de outro nucleo: nao encontra.
        var reports = new ReportService(db, Storage(db), NullLogger<ReportService>.Instance);
        await Assert.ThrowsAsync<AppException>(() => reports.GenerateAsync(
            new ReportRequest { ProjectIds = { f.B.ProjectId } }, "Admin"));
    }
}
