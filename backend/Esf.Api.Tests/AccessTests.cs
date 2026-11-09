using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>O acesso usa o nome e o e-mail do cadastro do voluntario; em Acessos so mudam perfil e situacao.</summary>
public class AccessTests
{
    private static FileStorageService Storage(EsfDbContext db) => new(db, Options.Create(new StorageOptions()));

    private static SaveVolunteerRequest Request(string name, string? email) => new()
    {
        Name = name,
        Email = email,
        Sector = VolunteerSector.Projetos,
        Status = VolunteerStatus.Ativo
    };

    [Fact]
    public async Task EditingTheVolunteerChangesNameAndLogin()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = new VolunteerService(db, Storage(db), new NotificationService(db, f.A.Admin));

        await volunteers.UpdateAsync(f.A.VolunteerId, Request("Nome Novo", "novo.a@teste.org"));
        var user = await db.Users.SingleAsync(u => u.Id == f.A.AdminUserId);
        Assert.Equal("Nome Novo", user.Name);
        Assert.Equal("novo.a@teste.org", user.Email);

        // O login de outra pessoa (mesmo de outro nucleo) nao pode ser usado, nem o e-mail em branco.
        await Assert.ThrowsAsync<AppException>(() => volunteers.UpdateAsync(f.A.VolunteerId, Request("Nome Novo", "admin.b@teste.org")));
        await Assert.ThrowsAsync<AppException>(() => volunteers.UpdateAsync(f.A.VolunteerId, Request("Nome Novo", null)));
    }

    [Fact]
    public async Task AccessEditChangesOnlyRoleAndSituation()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var system = f.SystemContext())
        {
            var other = new Domain.Entities.User
            {
                OrganizationId = f.A.OrganizationId,
                Name = "Conta antiga",
                Email = "antiga.a@teste.org",
                PasswordHash = "x",
                Role = UserRole.Usuario
            };
            system.Users.Add(other);
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var users = new UserService(db);
        var old = await db.Users.SingleAsync(u => u.Email == "antiga.a@teste.org");

        var updated = await users.UpdateAsync(old.Id, new UpdateUserRequest { Role = UserRole.Coordenador, IsActive = true }, f.A.AdminUserId);
        Assert.Equal(UserRole.Coordenador, updated.Role);
        Assert.Equal("Conta antiga", updated.Name);

        // Acesso antigo ligado a um voluntario (sem acesso): passa a usar o nome e o e-mail dele.
        var free = await db.Volunteers.SingleAsync(v => v.Email == "sem.acesso.a@teste.org");
        updated = await users.UpdateAsync(old.Id, new UpdateUserRequest { Role = UserRole.Coordenador, IsActive = true, VolunteerId = free.Id }, f.A.AdminUserId);
        Assert.Equal(free.Name, updated.Name);
        Assert.Equal("sem.acesso.a@teste.org", updated.Email);
    }

    [Fact]
    public async Task CoordinatorGivesAccessButNeverToOrForAnAdministrator()
    {
        var f = await TwoNucleos.CreateAsync();
        var coordinator = new TestUser { Id = Guid.NewGuid(), Name = "Coord", Role = UserRole.Coordenador, OrganizationId = f.A.OrganizationId };
        await using var db = f.Context(coordinator);
        var jwt = new JwtTokenService(Options.Create(new JwtOptions
        {
            Key = new string('k', 40), Issuer = "teste", Audience = "teste", ExpiresMinutes = 60
        }));
        var access = new AccessService(db, jwt, coordinator);

        // O perfil de administrador, nao; usuario, sim.
        await Assert.ThrowsAsync<AppException>(() => access.GrantFromNucleoAsync(f.A.VolunteerWithoutAccessId, UserRole.Administrador));
        var link = await access.GrantFromNucleoAsync(f.A.VolunteerWithoutAccessId, UserRole.Usuario);

        // Link novo para esse usuario, sim; para o administrador do nucleo (criaria a senha dele), nao.
        await access.NewLinkFromNucleoAsync(link.UserId);
        await Assert.ThrowsAsync<AppException>(() => access.NewLinkFromNucleoAsync(f.A.AdminUserId));

        // O cadastro mostra ate quando o link vale (o anterior foi anulado pelo novo).
        var volunteer = await new VolunteerService(db, Storage(db), new NotificationService(db, coordinator))
            .GetAsync(f.A.VolunteerWithoutAccessId);
        Assert.True(volunteer.Access!.Pending);
        Assert.NotNull(volunteer.Access.LinkExpiresAt);
        Assert.Single(await db.AccessLinks.Where(l => l.UserId == link.UserId).ToListAsync());
    }
}
