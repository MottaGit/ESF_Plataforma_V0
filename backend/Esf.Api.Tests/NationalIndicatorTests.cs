using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Indicadores nacionais: a gestao nacional define e todo projeto, de todos os nucleos, tem os ativos (em branco ate o
/// nucleo informar). O vinculo mantem nome e unidade iguais em todos os nucleos e e o que permite somar.
/// </summary>
public class NationalIndicatorTests
{
    private static readonly TestUser National = new() { Id = Guid.NewGuid(), Name = "Nacional", IsNational = true };

    private static async Task<NationalIndicatorDto> CreateNationalAsync(TwoNucleos f, string name, string unit)
    {
        await using var db = f.Context(National);
        return await new NationalIndicatorService(db).CreateAsync(new SaveNationalIndicatorRequest
        {
            Name = name, Unit = unit, Description = "Conte so quem usa a obra diretamente."
        });
    }

    private static async Task SetArchivedAsync(TwoNucleos f, Guid id, bool archived)
    {
        await using var db = f.Context(National);
        await new NationalIndicatorService(db).SetArchivedAsync(id, archived);
    }

    /// <summary>Indicadores do projeto ligados ao nacional (deve haver um so).</summary>
    private static async Task<List<Indicator>> LinkedAsync(TwoNucleos f, Guid projectId, Guid nationalId)
    {
        await using var db = f.SystemContext();
        return await db.Indicators.AsNoTracking()
            .Where(i => i.ProjectId == projectId && i.NationalIndicatorId == nationalId)
            .ToListAsync();
    }

    private static async Task<IndicatorDto> SetValueAsync(TwoNucleos f, Nucleo nucleo, Indicator linked, decimal? value)
    {
        await using var db = f.Context(nucleo.Admin);
        return await new IndicatorService(db).UpdateAsync(linked.Id, new SaveIndicatorRequest
        {
            Name = linked.Name, Unit = linked.Unit, Value = value, NationalIndicatorId = linked.NationalIndicatorId
        });
    }

    [Fact]
    public async Task NewNationalOneEntersEveryProjectOfEveryNucleoBlank()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");

        foreach (var nucleo in new[] { f.A, f.B })
        {
            var linked = Assert.Single(await LinkedAsync(f, nucleo.ProjectId, national.Id));
            Assert.Equal("Pessoas beneficiadas", linked.Name);
            Assert.Equal("pessoas", linked.Unit);
            // Em branco: nao informado ainda, diferente de zero.
            Assert.Null(linked.Value);
        }
    }

    [Fact]
    public async Task NewProjectGetsEachActiveNationalOnceEvenIfTheTemplateHasIt()
    {
        var f = await TwoNucleos.CreateAsync();
        var people = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");
        var archived = await CreateNationalAsync(f, "Banheiros construidos", "un.");
        await SetArchivedAsync(f, archived.Id, true);
        await using (var system = f.SystemContext())
        {
            system.ProgramTemplateIndicators.Add(new ProgramTemplateIndicator
            {
                ProgramId = f.A.ProgramId, Position = 1, Name = people.Name, Unit = people.Unit, NationalIndicatorId = people.Id
            });
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var created = await new ProjectService(db, new NotificationService(db, f.A.Admin)).CreateAsync(new SaveProjectRequest
        {
            Name = "Projeto novo", ProgramId = f.A.ProgramId, StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = ProjectStatus.Planejamento, UseTemplate = true
        });

        // O nacional ativo uma vez so (vem primeiro), o arquivado nao; o especifico do modelo entra em branco.
        Assert.Equal(new[] { "Pessoas beneficiadas", "Familias atendidas" }, created.Indicators.Select(i => i.Name));
        Assert.Equal(people.Id, created.Indicators[0].NationalIndicatorId);
        Assert.All(created.Indicators, i => Assert.Null(i.Value));
    }

    [Fact]
    public async Task NationalOneStaysInTheProjectAndTheValueCanBeBlank()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");
        var linked = Assert.Single(await LinkedAsync(f, f.A.ProjectId, national.Id));

        await using (var db = f.Context(f.A.Admin))
        {
            var service = new IndicatorService(db);
            await Assert.ThrowsAsync<AppException>(() => service.DeleteAsync(linked.Id));
            // Nem vira especifico (sairia da soma nacional)...
            await Assert.ThrowsAsync<AppException>(() => service.UpdateAsync(linked.Id, new SaveIndicatorRequest
            {
                Name = "Outro nome", Value = 3, NationalIndicatorId = null
            }));
            // ...nem entra de novo no mesmo projeto (a soma contaria em dobro).
            await Assert.ThrowsAsync<AppException>(() => service.CreateAsync(f.A.ProjectId, new SaveIndicatorRequest
            {
                Name = "x", Value = 3, NationalIndicatorId = national.Id
            }));
        }

        Assert.Equal(8, (await SetValueAsync(f, f.A, linked, 8)).Value);
        Assert.Null((await SetValueAsync(f, f.A, linked, null)).Value);
    }

    [Fact]
    public async Task RenamingTheNationalOneUpdatesEveryNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");

        await using (var db = f.Context(National))
            await new NationalIndicatorService(db).UpdateAsync(national.Id,
                new SaveNationalIndicatorRequest { Name = "Pessoas atendidas", Unit = "pessoas" });

        await using var system = f.SystemContext();
        var linked = await system.Indicators.Where(i => i.NationalIndicatorId == national.Id).ToListAsync();
        Assert.Equal(2, linked.Count);
        Assert.All(linked, i => Assert.Equal("Pessoas atendidas", i.Name));
    }

    [Fact]
    public async Task ArchivingStopsRequiringItAndReactivatingBringsItBack()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Familias atendidas", "familias");
        var linked = Assert.Single(await LinkedAsync(f, f.A.ProjectId, national.Id));
        await SetValueAsync(f, f.A, linked, 1);
        await SetArchivedAsync(f, national.Id, true);

        await using (var db = f.Context(f.A.Admin))
        {
            // Nucleo ve so os ativos e nao liga indicador novo a um arquivado...
            Assert.Empty(await new NationalIndicatorService(db).ListAsync(includeArchived: false));
            await Assert.ThrowsAsync<AppException>(() => new IndicatorService(db).CreateAsync(f.A.ProjectId,
                new SaveIndicatorRequest { Name = "x", Value = 2, NationalIndicatorId = national.Id }));
        }
        // ...o que ja estava ligado continua atualizando o valor e, sem a obrigacao, pode sair do projeto.
        Assert.Equal(2, (await SetValueAsync(f, f.A, linked, 2)).Value);
        await using (var db = f.Context(f.A.Admin))
            await new IndicatorService(db).DeleteAsync(linked.Id);
        Assert.Empty(await LinkedAsync(f, f.A.ProjectId, national.Id));

        // Reativado, volta a ser exigido: entra de novo (em branco) onde faltava.
        await SetArchivedAsync(f, national.Id, false);
        Assert.Null(Assert.Single(await LinkedAsync(f, f.A.ProjectId, national.Id)).Value);
        Assert.Single(await LinkedAsync(f, f.B.ProjectId, national.Id));
    }
}
