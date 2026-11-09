using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Esf.Api.Tests;

/// <summary>
/// Pagina publica do programa: a coordenacao liga e desliga; quem tem o link ve so dados objetivos dos projetos
/// daquele programa e daquele nucleo, sem login.
/// </summary>
public class PublicProgramPageTests
{
    private static async Task<string> EnableAsync(TwoNucleos f, Nucleo n, string? description = "Banheiros para famílias")
    {
        await using var db = f.Context(n.Admin);
        var page = await new ProgramService(db).SavePublicPageAsync(n.ProgramId,
            new SaveProgramPublicPageRequest { Enabled = true, Description = description });
        return page.Token!;
    }

    private static async Task<PublicProgramDto> OpenAsync(TwoNucleos f, string token)
    {
        await using var db = f.Context(TestUser.Anonymous);
        return await new PublicProgramService(db).GetAsync(token);
    }

    [Fact]
    public async Task StartsOffAndUnknownLinkDoesNotOpen()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        var page = await new ProgramService(db).GetPublicPageAsync(f.A.ProgramId);
        Assert.False(page.Enabled);
        Assert.Null(page.Token);

        var error = await Assert.ThrowsAsync<AppException>(() => OpenAsync(f, "codigo-inventado"));
        Assert.Equal(404, error.StatusCode);
    }

    [Fact]
    public async Task ShowsTheProgramProjectsWithoutLogin()
    {
        var f = await TwoNucleos.CreateAsync();
        var token = await EnableAsync(f, f.A);

        var page = await OpenAsync(f, token);

        Assert.Equal("Banheiros", page.Name);
        Assert.Equal("Banheiros para famílias", page.About);
        Assert.Equal("Nucleo A", page.Nucleo.Name);
        var project = Assert.Single(page.Projects);
        Assert.Equal("Projeto a", project.Name);
        Assert.Equal(ProjectStatus.EmAndamento, project.Status);
        Assert.Equal(1, page.Totals.InProgress);
        Assert.Equal(1, page.Totals.Volunteers);
        Assert.NotNull(page.UpdatedAt);
    }

    [Fact]
    public async Task EachLinkShowsOnlyItsOwnNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var tokenA = await EnableAsync(f, f.A);
        var tokenB = await EnableAsync(f, f.B);

        // Os dois nucleos tem um programa com o mesmo nome: cada link mostra so os projetos do seu.
        Assert.Equal(new[] { "Projeto a" }, (await OpenAsync(f, tokenA)).Projects.Select(p => p.Name));
        Assert.Equal(new[] { "Projeto b" }, (await OpenAsync(f, tokenB)).Projects.Select(p => p.Name));
        Assert.Equal("Nucleo B", (await OpenAsync(f, tokenB)).Nucleo.Name);
    }

    [Fact]
    public async Task CancelledStayOutArchivedCountsWithoutCardPausedAndPlannedShow()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.SystemContext())
        {
            var today = Mapping.Today;
            Project New(string name, ProjectStatus status, bool archived = false) => new()
            {
                OrganizationId = f.A.OrganizationId, ProgramId = f.A.ProgramId, Name = name, StartDate = today,
                Status = status, IsArchived = archived
            };
            db.Projects.AddRange(
                New("Pausado", ProjectStatus.Pausado),
                New("Planejado", ProjectStatus.Planejamento),
                New("Concluido", ProjectStatus.Concluido),
                New("Cancelado", ProjectStatus.Cancelado),
                New("Arquivado", ProjectStatus.Concluido, archived: true));
            await db.SaveChangesAsync();
        }

        var page = await OpenAsync(f, await EnableAsync(f, f.A));

        // O arquivado nao ganha cartao, mas continua nos numeros (arquivar nao apaga o que foi entregue).
        var names = page.Projects.Select(p => p.Name).ToList();
        Assert.Equal(new[] { "Projeto a", "Pausado", "Planejado", "Concluido" }, names);
        Assert.Equal((1, 1, 1, 2), (page.Totals.InProgress, page.Totals.Paused, page.Totals.Planning, page.Totals.Concluded));
        Assert.Equal(100, page.Projects.Single(p => p.Name == "Concluido").Progress);
    }

    [Fact]
    public async Task ResultsSumOnlyInformedValuesAndCountTeamAndHours()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.SystemContext())
        {
            var national = new NationalIndicator { Name = "Pessoas beneficiadas", Unit = "pessoas" };
            var second = new Project
            {
                OrganizationId = f.A.OrganizationId, ProgramId = f.A.ProgramId, Name = "Projeto a2",
                StartDate = Mapping.Today, Status = ProjectStatus.Concluido
            };
            var other = new Volunteer { OrganizationId = f.A.OrganizationId, Name = "Outra pessoa" };
            db.AddRange(national, second, other,
                new Indicator { ProjectId = f.A.ProjectId, Name = "Pessoas beneficiadas", NationalIndicatorId = national.Id, Value = 4 },
                new Indicator { ProjectId = second.Id, Name = "Pessoas beneficiadas", NationalIndicatorId = national.Id, Value = 5 },
                // Modelo do programa: "Familias atendidas" (o projeto a ja tem 1); no a2 fica em branco.
                new Indicator { ProjectId = second.Id, Name = "Famílias atendidas", Value = null },
                // Indicador que nao esta no modelo: aparece no cartao do projeto, mas nao soma nos resultados.
                new Indicator { ProjectId = second.Id, Name = "Metros de tubo", Unit = "m", Value = 12 },
                new ProjectVolunteer { ProjectId = second.Id, VolunteerId = f.A.VolunteerId },
                new ProjectVolunteer { ProjectId = second.Id, VolunteerId = other.Id },
                new ProjectHourEntry { ProjectId = f.A.ProjectId, VolunteerId = f.A.VolunteerId, Date = Mapping.Today, Hours = 3 },
                new ProjectHourEntry { ProjectId = second.Id, VolunteerId = other.Id, Date = Mapping.Today, Hours = 2.5m });
            await db.SaveChangesAsync();
        }

        var page = await OpenAsync(f, await EnableAsync(f, f.A));

        var summed = Assert.Single(page.Results, r => r.National);
        Assert.Equal(("Pessoas beneficiadas", 9m), (summed.Name, summed.Value));
        var families = Assert.Single(page.Results, r => !r.National);
        Assert.Equal(("Familias atendidas", 1m), (families.Name, families.Value));
        Assert.DoesNotContain(page.Results, r => r.Name == "Metros de tubo");

        // Em branco nao aparece no cartao; o especifico do projeto aparece.
        var card = page.Projects.Single(p => p.Name == "Projeto a2");
        Assert.Equal(new[] { "Pessoas beneficiadas", "Metros de tubo" }, card.Indicators.Select(i => i.Name));

        Assert.Equal(2, page.Totals.Volunteers); // sem repetir quem esta nos dois
        Assert.Equal(5.5m, page.Totals.Hours);
    }

    [Fact]
    public async Task TurningOffBreaksTheLinkAndTurningOnMakesANewOne()
    {
        var f = await TwoNucleos.CreateAsync();
        var first = await EnableAsync(f, f.A);

        await using (var db = f.Context(f.A.Admin))
        {
            // Salvar de novo ligada mantem o mesmo link.
            var same = await new ProgramService(db).SavePublicPageAsync(f.A.ProgramId,
                new SaveProgramPublicPageRequest { Enabled = true, Description = "Outro texto" });
            Assert.Equal(first, same.Token);

            var off = await new ProgramService(db).SavePublicPageAsync(f.A.ProgramId,
                new SaveProgramPublicPageRequest { Enabled = false, Description = "Outro texto" });
            Assert.False(off.Enabled);
            Assert.Equal("Outro texto", off.Description);
        }
        await Assert.ThrowsAsync<AppException>(() => OpenAsync(f, first));

        var second = await EnableAsync(f, f.A);
        Assert.NotEqual(first, second);
        await Assert.ThrowsAsync<AppException>(() => OpenAsync(f, first));
        Assert.Equal("Banheiros", (await OpenAsync(f, second)).Name);
    }

    [Fact]
    public async Task OtherNucleoCannotConfigureTheProgram()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.B.Admin);

        await Assert.ThrowsAsync<AppException>(() => new ProgramService(db).SavePublicPageAsync(f.A.ProgramId,
            new SaveProgramPublicPageRequest { Enabled = true }));
        await Assert.ThrowsAsync<AppException>(() => new ProgramService(db).GetPublicPageAsync(f.A.ProgramId));

        await using var check = f.SystemContext();
        Assert.Null((await check.Programs.SingleAsync(p => p.Id == f.A.ProgramId)).PublicToken);
    }
}
