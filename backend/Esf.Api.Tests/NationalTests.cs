using System.IdentityModel.Tokens.Jwt;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Gestao nacional: cuida dos nucleos e das proprias pessoas, sem enxergar os dados de dentro dos nucleos.
/// </summary>
public class NationalTests
{
    private static JwtTokenService Jwt() => new(Options.Create(new JwtOptions
    {
        Key = new string('k', 40),
        Issuer = "teste",
        Audience = "teste",
        ExpiresMinutes = 60
    }));

    /// <summary>Conta so da gestao nacional, logada.</summary>
    private static TestUser NationalOnly(Guid id) => new() { Id = id, Name = "Nacional", Role = UserRole.Usuario, IsNational = true };

    private static async Task<Guid> CreateNationalAccountAsync(TwoNucleos f, string email = "nacional@teste.org")
    {
        await using var system = f.SystemContext();
        await NationalService.EnsureInitialAccountAsync(system,
            new NationalOptions { AdminEmail = email, AdminPassword = TwoNucleos.Password }, NullLogger.Instance);
        return (await system.Users.SingleAsync(u => u.Email == email)).Id;
    }

    [Fact]
    public async Task InitialAccountIsCreatedOnceAndLogsInWithoutNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var id = await CreateNationalAccountAsync(f);
        // Segunda subida do servidor, com outro e-mail configurado: ja existe conta nacional, nada muda.
        await using (var system = f.SystemContext())
        {
            await NationalService.EnsureInitialAccountAsync(system,
                new NationalOptions { AdminEmail = "outra.pessoa@teste.org", AdminPassword = TwoNucleos.Password }, NullLogger.Instance);
            Assert.Equal(1, await system.Users.CountAsync(u => u.IsNational));
            Assert.False(await system.Users.AnyAsync(u => u.Email == "outra.pessoa@teste.org"));
        }

        await using var db = f.Context(TestUser.Anonymous);
        var login = await new AuthService(db, Jwt()).LoginAsync(new LoginRequest { Email = "nacional@teste.org", Password = TwoNucleos.Password });
        var token = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Contains(token.Claims, c => c.Type == CurrentUser.NationalClaim);
        Assert.DoesNotContain(token.Claims, c => c.Type == CurrentUser.OrganizationClaim);
        Assert.Equal(id, login.User.Id);
        Assert.Null(login.User.OrganizationId);
    }

    [Fact]
    public async Task NationalOnlyAccountSeesNoDataInsideTheNucleos()
    {
        var f = await TwoNucleos.CreateAsync();
        var id = await CreateNationalAccountAsync(f);
        await using var db = f.Context(NationalOnly(id));

        Assert.Empty(await db.Volunteers.ToListAsync());
        Assert.Empty(await db.Projects.ToListAsync());
        Assert.Empty(await db.Activities.ToListAsync());
        Assert.Empty(await db.Organizations.ToListAsync());
    }

    [Fact]
    public async Task NucleosListShowsCountsAndAdminsOfEveryNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var id = await CreateNationalAccountAsync(f);
        await using var db = f.Context(NationalOnly(id));
        var national = new NationalService(db, new AccessService(db, Jwt(), NationalOnly(id)), NationalOnly(id));

        var nucleos = await national.ListNucleosAsync();

        Assert.Equal(new[] { "Nucleo A", "Nucleo B" }, nucleos.Select(n => n.Name));
        Assert.All(nucleos, n =>
        {
            Assert.Equal(2, n.ActiveVolunteers);
            Assert.Equal(1, n.ActiveProjects);
            Assert.Single(n.Admins);
        });
    }

    [Fact]
    public async Task NewNucleoAdminEntersOnlyTheNewNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var id = await CreateNationalAccountAsync(f);
        AccessLinkDto link;
        Guid nucleoId;
        await using (var db = f.Context(NationalOnly(id)))
        {
            var national = new NationalService(db, new AccessService(db, Jwt(), NationalOnly(id)), NationalOnly(id));
            var created = await national.CreateNucleoAsync(new CreateNucleoRequest
            {
                Name = "Nucleo C", City = "Curitiba", State = "PR", AdminName = "Admin C", AdminEmail = "admin.c@teste.org"
            });
            link = created.Link!;
            nucleoId = created.Nucleo.Id;
            Assert.Equal("admin.c@teste.org", Assert.Single(created.Nucleo.Admins).Email);
            Assert.True(created.Nucleo.Admins[0].Pending);
        }

        await using var publicDb = f.Context(TestUser.Anonymous);
        var login = await new AccessService(publicDb, Jwt(), TestUser.Anonymous)
            .UseAsync(link.Token, new UseAccessLinkRequest { Password = "Nova@123", AcceptTerms = true });
        Assert.Equal(nucleoId, login.User.OrganizationId);
        Assert.Equal(UserRole.Administrador, login.User.Role);

        // O administrador novo so ve o proprio nucleo: ele mesmo como voluntario, nenhum projeto de A ou B.
        await using var adminDb = f.Context(new TestUser { Id = login.User.Id, Role = UserRole.Administrador, OrganizationId = nucleoId });
        Assert.Equal("Admin C", Assert.Single(await adminDb.Volunteers.ToListAsync()).Name);
        Assert.Empty(await adminDb.Projects.ToListAsync());
    }

    [Fact]
    public async Task PeopleOfTheNationalManagement()
    {
        var f = await TwoNucleos.CreateAsync();
        var id = await CreateNationalAccountAsync(f);
        await using var db = f.Context(NationalOnly(id));
        var national = new NationalService(db, new AccessService(db, Jwt(), NationalOnly(id)), NationalOnly(id));

        // Alguem de um nucleo ganha a permissao e continua com a senha que tem (sem link).
        var fromNucleo = await national.AddPersonAsync(new PersonRequest { Name = "Admin A", Email = f.A.AdminEmail });
        Assert.Null(fromNucleo.Link);
        Assert.Equal("Nucleo A", fromNucleo.Person.NucleoName);

        // Pessoa nova: conta so nacional, com link de primeiro acesso.
        var newcomer = await national.AddPersonAsync(new PersonRequest { Name = "Diretora", Email = "diretora@teste.org" });
        Assert.NotNull(newcomer.Link);
        Assert.Null(newcomer.Person.NucleoName);

        Assert.Equal(3, (await national.ListPeopleAsync()).Count);
        await Assert.ThrowsAsync<AppException>(() => national.RemovePersonAsync(id));

        await national.RemovePersonAsync(newcomer.Person.UserId);
        await using var system = f.SystemContext();
        var removed = await system.Users.SingleAsync(u => u.Id == newcomer.Person.UserId);
        Assert.False(removed.IsNational);
        Assert.False(removed.IsActive);
    }
}
