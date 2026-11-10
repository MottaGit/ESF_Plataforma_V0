using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Meta do programa: fica no indicador padrao do modelo (ex.: 55 banheiros) e e comparada com a soma dos projetos do
/// programa. Os projetos nao tem meta propria.
/// </summary>
public class IndicatorTargetTests
{
    [Fact]
    public async Task ProgramGoalShowsInTheProgramViewAndOnThePublicPage()
    {
        var f = await TwoNucleos.CreateAsync();
        var people = new NationalIndicator { Name = "Pessoas beneficiadas", Unit = "pessoas" };
        await using (var system = f.SystemContext())
        {
            system.NationalIndicators.Add(people);
            system.Indicators.Add(new Indicator
            {
                ProjectId = f.A.ProjectId, Name = people.Name, Unit = people.Unit, NationalIndicatorId = people.Id, Value = 8
            });
            (await system.ProgramTemplateIndicators.SingleAsync(t => t.ProgramId == f.A.ProgramId)).Target = 55;
            // O nacional ganha meta pelo indicador padrao ligado a ele.
            system.ProgramTemplateIndicators.Add(new ProgramTemplateIndicator
            {
                ProgramId = f.A.ProgramId, Position = 1, Name = people.Name, Unit = people.Unit,
                NationalIndicatorId = people.Id, Target = 100
            });
            await system.SaveChangesAsync();
        }

        string token;
        await using (var db = f.Context(f.A.Admin))
        {
            var program = await new ProgramService(db).GetAsync(f.A.ProgramId);
            Assert.Equal(55, program.Results.Single(r => r.Name == "Familias atendidas").Target);
            Assert.Equal(100, program.Results.Single(r => r.National).Target);
            token = (await new ProgramService(db).SavePublicPageAsync(f.A.ProgramId,
                new SaveProgramPublicPageRequest { Enabled = true })).Token!;
        }

        await using (var anonymous = f.Context(TestUser.Anonymous))
        {
            var page = await new PublicProgramService(anonymous).GetAsync(token);
            Assert.Equal(55, page.Results.Single(r => r.Name == "Familias atendidas").Target);
            // Os indicadores de cada projeto nao tem meta.
            Assert.All(page.Projects.SelectMany(p => p.Indicators), i => Assert.Null(i.Target));
        }
    }

    [Fact]
    public void TheGoalComesFromTheTemplateIncludingTheNationalOnes()
    {
        var nationalId = Guid.NewGuid();
        var project = Guid.NewGuid();
        var totals = ResultTotals.Compute(
            new[]
            {
                new ResultTotals.Item(project, "Banheiros construídos", "un.", 1, null),
                new ResultTotals.Item(project, "Pessoas beneficiadas", "pessoas", 5, nationalId)
            },
            new[]
            {
                new ResultTotals.Template("Banheiros construídos", "un.", null, 55),
                new ResultTotals.Template("Pessoas beneficiadas", "pessoas", nationalId, 200)
            });

        Assert.Equal(55, totals.Single(t => t.NationalIndicatorId == null).Target);
        Assert.Equal(200, totals.Single(t => t.NationalIndicatorId == nationalId).Target);
    }

    [Fact]
    public void ReportWithPartOfTheProgramComparesTheGoalWithTheWholeProgram()
    {
        var program = new ProjectProgram { Name = "Banheiro Direito da Gente" };
        Project Project(string name, decimal built)
        {
            var project = new Project { Name = name, ProgramId = program.Id, Program = program };
            project.Indicators.Add(new Indicator { ProjectId = project.Id, Name = "Banheiros construídos", Unit = "un.", Value = built });
            return project;
        }
        var a = Project("A", 1);
        var b = Project("B", 1);
        var template = new ProgramTemplateIndicator { ProgramId = program.Id, Name = "Banheiros construídos", Unit = "un.", Target = 55 };
        var key = ResultTotals.Key(new ResultTotals.Total("Banheiros construídos", "un.", 12, 12, 12, null));

        // O programa tem mais um projeto (C) fora do relatorio: 12 banheiros no programa todo.
        var partial = Assert.Single(ReportService.ProgramResults(new List<Project> { a, b }, new() { template }, new(),
            new() { [program.Id] = new ReportProgramWide(new HashSet<Guid> { a.Id, b.Id, Guid.NewGuid() }, new() { [key] = 12 }) }));
        Assert.False(partial.WholeProgram);
        var result = Assert.Single(partial.Results);
        Assert.Equal(2, result.Total);
        Assert.Equal(55, result.Target);
        Assert.Equal(12, result.ProgramTotal);

        // Com todos os projetos do programa no relatorio, a soma do relatorio ja e a do programa.
        var whole = Assert.Single(ReportService.ProgramResults(new List<Project> { a, b }, new() { template }, new(),
            new() { [program.Id] = new ReportProgramWide(new HashSet<Guid> { a.Id, b.Id }, new() { [key] = 2 }) }));
        Assert.True(whole.WholeProgram);
    }
}
