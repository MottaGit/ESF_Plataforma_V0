using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Esf.Api.Tests;

/// <summary>
/// Parceiros do programa: a coordenacao grava a lista inteira (cria, altera, reordena, apaga); nome e papel aparecem na
/// visao do programa e na pagina publica, o contato fica so dentro do nucleo.
/// </summary>
public class ProgramPartnersTests
{
    private static SaveProgramPartnerRequest Partner(string name, string? role = null, Guid? id = null) =>
        new() { Id = id, Name = name, Role = role };

    [Fact]
    public async Task SavingTheListCreatesUpdatesReordersAndRemoves()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var programs = new ProgramService(db);

        var start = Assert.Single(await programs.GetPartnersAsync(f.A.ProgramId));
        Assert.Equal(("Instituto a", "contato.a@parceiro.org"), (start.Name, start.Email));

        // Um novo na frente, o que existia muda de papel e perde o contato.
        var saved = await programs.SavePartnersAsync(f.A.ProgramId, new SaveProgramPartnersRequest
        {
            Partners =
            {
                Partner("  Prefeitura de Porto Alegre ", "Poder público"),
                new SaveProgramPartnerRequest { Id = start.Id, Name = "Instituto a", Role = "Apoiador", Email = " " }
            }
        });
        Assert.Equal(new[] { "Prefeitura de Porto Alegre", "Instituto a" }, saved.Select(p => p.Name));
        Assert.Equal(start.Id, saved[1].Id);
        Assert.Equal("Apoiador", saved[1].Role);
        Assert.Null(saved[1].Email);

        // O que nao vem na lista e apagado.
        var after = await programs.SavePartnersAsync(f.A.ProgramId, new SaveProgramPartnersRequest
        {
            Partners = { Partner("Prefeitura de Porto Alegre", "Poder público", saved[0].Id) }
        });
        Assert.Equal(saved[0].Id, Assert.Single(after).Id);

        // A visao do programa leva so os nomes.
        Assert.Equal(new[] { "Prefeitura de Porto Alegre" }, (await programs.GetAsync(f.A.ProgramId)).Partners);
    }

    [Fact]
    public async Task OtherNucleoCannotSeeNorChangeThePartners()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.B.Admin);
        var programs = new ProgramService(db);

        await Assert.ThrowsAsync<AppException>(() => programs.GetPartnersAsync(f.A.ProgramId));
        await Assert.ThrowsAsync<AppException>(() => programs.SavePartnersAsync(f.A.ProgramId,
            new SaveProgramPartnersRequest { Partners = { Partner("Intruso") } }));

        await using var check = f.SystemContext();
        Assert.Equal("Instituto a", (await check.ProgramPartners.SingleAsync(p => p.ProgramId == f.A.ProgramId)).Name);
    }

    [Fact]
    public async Task PublicPageShowsNameAndRoleInOrder()
    {
        var f = await TwoNucleos.CreateAsync();
        string token;
        await using (var db = f.Context(f.A.Admin))
        {
            var programs = new ProgramService(db);
            var current = Assert.Single(await programs.GetPartnersAsync(f.A.ProgramId));
            await programs.SavePartnersAsync(f.A.ProgramId, new SaveProgramPartnersRequest
            {
                Partners = { Partner("Instituto a", "Financiador", current.Id), Partner("Associação do bairro") }
            });
            token = (await programs.SavePublicPageAsync(f.A.ProgramId, new SaveProgramPublicPageRequest { Enabled = true })).Token!;
        }

        await using var anonymous = f.Context(TestUser.Anonymous);
        var page = await new PublicProgramService(anonymous).GetAsync(token);

        // So nome e papel: o DTO publico nem tem campo de contato.
        Assert.Equal(
            new[] { new PublicPartnerDto("Instituto a", "Financiador"), new PublicPartnerDto("Associação do bairro", null) },
            page.Partners);
    }

    [Fact]
    public async Task ContactChangesGoToTheHistoryWithoutTheValue()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.Context(f.A.Admin))
        {
            // Na API o AuditInterceptor faz isto no SaveChanges; aqui o historico e gravado a mao.
            var partner = await db.ProgramPartners.Include(p => p.Program).SingleAsync();
            partner.Role = "Apoiador";
            partner.ContactName = "Pessoa nova";
            partner.Email = "nova@parceiro.org";
            await AuditTrail.RecordAsync(db, f.A.AdminUserId, default);
            await db.SaveChangesAsync();
        }

        await using var check = f.Context(f.A.Admin);
        var entry = await check.AuditEntries.SingleAsync(e => e.EntityType == "Parceiro do programa");
        Assert.Equal("Banheiros: Instituto a", entry.EntityLabel);
        Assert.Contains("Apoiador", entry.Changes);
        Assert.Contains("E-mail", entry.Changes);
        Assert.DoesNotContain("Pessoa nova", entry.Changes);
        Assert.DoesNotContain("nova@parceiro.org", entry.Changes);
        Assert.DoesNotContain("contato.a@parceiro.org", entry.Changes);
    }
}
