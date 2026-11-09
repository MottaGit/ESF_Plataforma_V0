using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Regra unica dos resultados somados (visao do programa, PDF, pagina publica e painel nacional): nacionais pelo
/// vinculo, modelo pelo nome, so os valores informados (vazio nao vira zero), arquivados entram e cancelados nao.
/// </summary>
public class ResultTotalsTests
{
    [Fact]
    public void SumsOnlyInformedValuesAndSaysHowManyProjectsInformed()
    {
        var national = Guid.NewGuid();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();
        var items = new[]
        {
            new ResultTotals.Item(p1, "Pessoas beneficiadas", "pessoas", 8, national),
            new ResultTotals.Item(p2, "Pessoas beneficiadas", "pessoas", null, national),
            new ResultTotals.Item(p1, "familias atendidas", null, 3, null),
            new ResultTotals.Item(p2, "Famílias Atendidas", null, null, null),
            new ResultTotals.Item(p1, "Metros de tubo", "m", 12, null)
        };
        var templates = new[]
        {
            new ResultTotals.Template("Famílias atendidas", "famílias", null),
            new ResultTotals.Template("Banheiros construídos", "un.", null),
            // Ligado ao nacional: ja entra pelo vinculo, nao repete.
            new ResultTotals.Template("Pessoas beneficiadas", "pessoas", national)
        };

        var results = ResultTotals.Compute(items, templates);

        Assert.Equal(new[] { "Pessoas beneficiadas", "Famílias atendidas", "Banheiros construídos" }, results.Select(r => r.Name));
        Assert.Equal(new ResultTotals.Total("Pessoas beneficiadas", "pessoas", 8, 1, 2, national), results[0]);
        Assert.Equal(new ResultTotals.Total("Famílias atendidas", "famílias", 3, 1, 2, null), results[1]);
        // Nenhum projeto tem: sem valor (nao e zero).
        Assert.Equal(new ResultTotals.Total("Banheiros construídos", "un.", null, 0, 0, null), results[2]);
        Assert.DoesNotContain(results, r => r.Name == "Metros de tubo");

        Assert.Equal("informado em 1 de 2 projetos", ResultTotals.Coverage(1, 2));
        Assert.Null(ResultTotals.Coverage(2, 2));
    }

    [Fact]
    public async Task ProgramResultsKeepArchivedProjectsLeaveCancelledOutAndNeverTurnBlankIntoZero()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.SystemContext())
        {
            var national = new NationalIndicator { Name = "Pessoas beneficiadas", Unit = "pessoas" };
            Project New(string name, ProjectStatus status, bool archived = false) => new()
            {
                OrganizationId = f.A.OrganizationId, ProgramId = f.A.ProgramId, Name = name, StartDate = Mapping.Today,
                Status = status, IsArchived = archived
            };
            var archived = New("Arquivado", ProjectStatus.Concluido, archived: true);
            var cancelled = New("Cancelado", ProjectStatus.Cancelado);
            var paused = New("Pausado", ProjectStatus.Pausado);
            db.AddRange(national, archived, cancelled, paused,
                new Indicator { ProjectId = archived.Id, Name = "Familias atendidas", Value = 2 },
                new Indicator { ProjectId = cancelled.Id, Name = "Familias atendidas", Value = 5 },
                new Indicator { ProjectId = f.A.ProjectId, Name = "Pessoas beneficiadas", NationalIndicatorId = national.Id },
                new Indicator { ProjectId = archived.Id, Name = "Pessoas beneficiadas", NationalIndicatorId = national.Id });
            await db.SaveChangesAsync();
        }

        await using var dbA = f.Context(f.A.Admin);
        var program = await new ProgramService(dbA).GetAsync(f.A.ProgramId);

        // Projeto a (1) + arquivado (2); o cancelado fica de fora. Informado em 2 dos 2 projetos que tem o indicador.
        var families = Assert.Single(program.Results, r => !r.National);
        Assert.Equal(new ProgramResultDto("Familias atendidas", null, 3, 2, 2, false), families);
        // Nacional em branco nos dois projetos: sem valor, nunca zero.
        var people = Assert.Single(program.Results, r => r.National);
        Assert.Equal((null, 0, 2), (people.Total, people.Informed, people.Projects));
        // Ativos: em andamento e pausado (sem arquivados); concluidos contam o arquivado.
        Assert.Equal((2, 1), (program.ActiveProjectsCount, program.DoneProjectsCount));
    }

    [Fact]
    public async Task NationalPanelKeepsArchivedResultsAndLeavesCancelledOut()
    {
        var f = await TwoNucleos.CreateAsync();
        var nationalId = Guid.NewGuid();
        await using (var db = f.SystemContext())
        {
            var national = new NationalIndicator { Id = nationalId, Name = "Familias atendidas", Unit = "familias" };
            var project = await db.Projects.SingleAsync(p => p.Id == f.A.ProjectId);
            project.Status = ProjectStatus.Concluido;
            project.IsArchived = true;
            var cancelled = new Project
            {
                OrganizationId = f.A.OrganizationId, ProgramId = f.A.ProgramId, Name = "Cancelado",
                StartDate = Mapping.Today, Status = ProjectStatus.Cancelado
            };
            var paused = new Project
            {
                OrganizationId = f.B.OrganizationId, ProgramId = f.B.ProgramId, Name = "Pausado",
                StartDate = Mapping.Today, Status = ProjectStatus.Pausado
            };
            db.AddRange(national, cancelled, paused,
                new Indicator { ProjectId = f.A.ProjectId, Name = national.Name, NationalIndicatorId = nationalId, Value = 3 },
                new Indicator { ProjectId = cancelled.Id, Name = national.Name, NationalIndicatorId = nationalId, Value = 7 },
                new Indicator { ProjectId = paused.Id, Name = national.Name, NationalIndicatorId = nationalId });
            await db.SaveChangesAsync();
        }

        var user = new TestUser { Id = Guid.NewGuid(), Name = "Nacional", Role = UserRole.Usuario, IsNational = true };
        await using var panelDb = f.Context(user);
        var jwt = new JwtTokenService(Options.Create(new JwtOptions
        {
            Key = new string('k', 40), Issuer = "teste", Audience = "teste", ExpiresMinutes = 60
        }));
        var panel = await new NationalService(panelDb, new AccessService(panelDb, jwt, user), user).PanelAsync(null, null);

        var a = panel.Nucleos.Single(n => n.Id == f.A.OrganizationId);
        var b = panel.Nucleos.Single(n => n.Id == f.B.OrganizationId);
        // O projeto de A foi concluido e arquivado: continua nos concluidos e no indicador; o cancelado nao soma.
        Assert.Equal((0, 1), (a.ActiveProjects, a.ConcludedProjects));
        Assert.Equal(new NationalIndicatorValueDto(3, 1, 1), a.Indicators[nationalId]);
        // B: em andamento + pausado sao ativos; o pausado em branco nao vira zero.
        Assert.Equal(2, b.ActiveProjects);
        Assert.Equal(new NationalIndicatorValueDto(null, 0, 1), b.Indicators[nationalId]);
        var total = Assert.Single(panel.Indicators);
        Assert.Equal((3m, 1, 2), (total.Total, total.Informed, total.Projects));
    }
}
