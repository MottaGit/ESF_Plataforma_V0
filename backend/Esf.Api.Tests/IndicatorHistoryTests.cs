using Esf.Api.Common;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Historico dos indicadores: cada mudanca de valor vira uma linha, e o relatorio le dele o valor no fim do periodo e
/// quanto o numero mudou dentro do periodo.
/// </summary>
public class IndicatorHistoryTests
{
    private static DateTime Utc(int year, int month, int day, int hour = 15) =>
        new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task EveryValueChangeIsRecordedButRenamingIsNot()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var service = new IndicatorService(db);

        var created = await service.CreateAsync(f.A.ProjectId, new SaveIndicatorRequest { Name = "Canteiros", Unit = "un.", Value = 10 });
        await service.UpdateAsync(created.Id, new SaveIndicatorRequest { Name = "Canteiros prontos", Unit = "un.", Value = 10 });
        await service.UpdateAsync(created.Id, new SaveIndicatorRequest { Name = "Canteiros prontos", Unit = "un.", Value = 15 });
        await service.UpdateAsync(created.Id, new SaveIndicatorRequest { Name = "Canteiros prontos", Unit = "un.", Value = null });

        var history = await db.IndicatorValueChanges
            .Where(c => c.IndicatorId == created.Id)
            .OrderBy(c => c.ChangedAt)
            .Select(c => c.Value)
            .ToListAsync();
        Assert.Equal(new decimal?[] { 10, 15, null }, history);

        // Indicador novo sem valor nao entra no historico.
        var empty = await service.CreateAsync(f.A.ProjectId, new SaveIndicatorRequest { Name = "Oficinas" });
        Assert.False(await db.IndicatorValueChanges.AnyAsync(c => c.IndicatorId == empty.Id));
    }

    [Fact]
    public void FiguresUseTheValueAtTheEndOfThePeriodAndTheChangeInIt()
    {
        var indicator = new Indicator { Name = "Pessoas", Value = 40, ValueUpdatedAt = Utc(2026, 10, 20) };
        var history = new[]
        {
            new IndicatorValueChange { IndicatorId = indicator.Id, Value = 10, ChangedAt = Utc(2026, 3, 10) },
            // 23 h de 30/06 em Brasilia (02 h de 01/07 em UTC): ainda e junho, antes do trimestre.
            new IndicatorValueChange { IndicatorId = indicator.Id, Value = 12, ChangedAt = Utc(2026, 7, 1, 2) },
            new IndicatorValueChange { IndicatorId = indicator.Id, Value = 25, ChangedAt = Utc(2026, 8, 5) },
            new IndicatorValueChange { IndicatorId = indicator.Id, Value = 40, ChangedAt = Utc(2026, 10, 20) }
        };
        var today = new DateOnly(2026, 11, 10);

        // Trimestre passado: o valor de 30/09 e quanto mudou desde 30/06.
        var quarter = IndicatorHistory.Figures(new[] { indicator }, history, new DateOnly(2026, 7, 1), new DateOnly(2026, 9, 30), today)[indicator.Id];
        Assert.Equal(25, quarter.Value);
        Assert.Equal(12, quarter.Start);
        Assert.Equal(13, quarter.Change);
        Assert.Equal(Utc(2026, 8, 5), quarter.UpdatedAt);

        // Periodo que vai ate hoje: o valor de hoje.
        var untilToday = IndicatorHistory.Figures(new[] { indicator }, history, new DateOnly(2026, 8, 11), today, today)[indicator.Id];
        Assert.Equal(40, untilToday.Value);
        Assert.Equal(15, untilToday.Change);

        // Sem periodo: o valor de hoje, sem comeco.
        var all = IndicatorHistory.Figures(new[] { indicator }, history, null, null, today)[indicator.Id];
        Assert.Equal(40, all.Value);
        Assert.Null(all.Start);

        // Antes de o numero ser informado, nao informado (nunca zero).
        var before = IndicatorHistory.Figures(new[] { indicator }, history, null, new DateOnly(2026, 2, 28), today)[indicator.Id];
        Assert.Null(before.Value);
        Assert.Null(before.UpdatedAt);

        // Informado pela primeira vez no periodo: tudo conta como mudanca.
        var firstTime = IndicatorHistory.Figures(new[] { indicator }, history, new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31), today)[indicator.Id];
        Assert.Equal(10, firstTime.Value);
        Assert.Equal(10, firstTime.Change);
    }

    [Fact]
    public void ProgramResultsSumTheEndOfPeriodValuesAndTheirChange()
    {
        var program = new ProjectProgram { Name = "Banheiros" };
        var nationalId = Guid.NewGuid();
        Project Project(string name) => new() { Name = name, ProgramId = program.Id, Program = program };
        var a = Project("A");
        var b = Project("B");
        var inA = new Indicator { ProjectId = a.Id, Name = "Pessoas beneficiadas", NationalIndicatorId = nationalId, Value = 9 };
        var inB = new Indicator { ProjectId = b.Id, Name = "Pessoas beneficiadas", NationalIndicatorId = nationalId, Value = 6 };
        a.Indicators.Add(inA);
        b.Indicators.Add(inB);

        var figures = new Dictionary<Guid, IndicatorFigure>
        {
            // A ja tinha 5 no comeco do periodo e terminou com 8; B foi informado so no periodo.
            [inA.Id] = new(8, null, 5),
            [inB.Id] = new(6, null, null)
        };

        var result = Assert.Single(Assert.Single(ReportService.ProgramResults(new List<Project> { a, b }, new(), figures)).Results);
        Assert.Equal(14, result.Total);
        Assert.Equal(9, result.Change);
        Assert.Equal(2, result.Informed);
    }
}
