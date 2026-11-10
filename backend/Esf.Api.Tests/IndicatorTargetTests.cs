using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>Meta dos indicadores: vem do modelo do programa, fica no projeto e o relatorio compara com o realizado.</summary>
public class IndicatorTargetTests
{
    [Fact]
    public async Task NewProjectGetsTheTemplateTargetsIncludingTheNationalOne()
    {
        var f = await TwoNucleos.CreateAsync();
        var people = new NationalIndicator { Name = "Pessoas beneficiadas", Unit = "pessoas" };
        await using (var system = f.SystemContext())
        {
            system.NationalIndicators.Add(people);
            (await system.ProgramTemplateIndicators.SingleAsync(t => t.ProgramId == f.A.ProgramId)).Target = 1;
            system.ProgramTemplateIndicators.Add(new ProgramTemplateIndicator
            {
                ProgramId = f.A.ProgramId, Position = 1, Name = people.Name, Unit = people.Unit,
                NationalIndicatorId = people.Id, Target = 5
            });
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var created = await new ProjectService(db, new NotificationService(db, f.A.Admin)).CreateAsync(new SaveProjectRequest
        {
            Name = "Projeto novo", ProgramId = f.A.ProgramId, StartDate = Mapping.Today,
            Status = ProjectStatus.Planejamento, UseTemplate = true
        });

        // O nacional ja entra no projeto antes do modelo; a meta do modelo vai para ele mesmo assim.
        Assert.Equal(5, created.Indicators.Single(i => i.NationalIndicatorId == people.Id).Target);
        Assert.Equal(1, created.Indicators.Single(i => i.Name == "Familias atendidas").Target);
        Assert.All(created.Indicators, i => Assert.Null(i.Value));
    }

    [Fact]
    public async Task TheTargetIsSavedWithTheIndicatorAndGoesToTheHistory()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var service = new IndicatorService(db);

        var created = await service.CreateAsync(f.A.ProjectId,
            new SaveIndicatorRequest { Name = "Canteiros", Unit = "un.", Target = 12 });
        var updated = await service.UpdateAsync(created.Id,
            new SaveIndicatorRequest { Name = "Canteiros", Unit = "un.", Value = 5, Target = 12 });

        Assert.Equal(12, updated.Target);
        Assert.Equal(5, updated.Value);
    }

    [Fact]
    public void ProgramTargetOnlySumsWhenEveryProjectHasOne()
    {
        ResultTotals.Item Item(decimal? value, decimal? target) =>
            new(Guid.NewGuid(), "Banheiros construídos", "un.", value, null, target);

        // Todos com meta: realizado 1 de 2 previstos (o que ainda nao foi informado continua fora do realizado).
        var all = ResultTotals.Build("Banheiros construídos", "un.", new[] { Item(1, 1), Item(null, 1) }, null);
        Assert.Equal(1, all.Value);
        Assert.Equal(2, all.Target);

        // Um sem meta: a soma das metas compararia coisas diferentes, entao nao sai.
        var partial = ResultTotals.Build("Banheiros construídos", "un.", new[] { Item(1, 1), Item(3, null) }, null);
        Assert.Null(partial.Target);
    }
}
