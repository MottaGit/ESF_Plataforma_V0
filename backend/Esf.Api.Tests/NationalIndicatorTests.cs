using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Indicadores nacionais: a gestao nacional define, os nucleos escolhem, e o vinculo mantem nome e unidade iguais em
/// todos os nucleos (e o que permite somar).
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

    private static async Task<IndicatorDto> LinkAsync(TwoNucleos f, Nucleo nucleo, Guid nationalId, decimal value)
    {
        await using var db = f.Context(nucleo.Admin);
        return await new IndicatorService(db).CreateAsync(nucleo.ProjectId, new SaveIndicatorRequest
        {
            // Nome e unidade enviados sao ignorados: vem do nacional.
            Name = "qualquer nome", Unit = "qualquer", Value = value, NationalIndicatorId = nationalId
        });
    }

    [Fact]
    public async Task ProjectIndicatorTakesNameAndUnitFromTheNationalOne()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");

        var linked = await LinkAsync(f, f.A, national.Id, 8);

        Assert.Equal("Pessoas beneficiadas", linked.Name);
        Assert.Equal("pessoas", linked.Unit);
        Assert.Equal(national.Id, linked.NationalIndicatorId);
        // O mesmo nacional duas vezes no projeto somaria em dobro.
        await Assert.ThrowsAsync<AppException>(() => LinkAsync(f, f.A, national.Id, 3));
    }

    [Fact]
    public async Task RenamingTheNationalOneUpdatesEveryNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");
        await LinkAsync(f, f.A, national.Id, 8);
        await LinkAsync(f, f.B, national.Id, 5);

        await using (var db = f.Context(National))
            await new NationalIndicatorService(db).UpdateAsync(national.Id,
                new SaveNationalIndicatorRequest { Name = "Pessoas atendidas", Unit = "pessoas" });

        await using var system = f.SystemContext();
        var linked = await system.Indicators.Where(i => i.NationalIndicatorId == national.Id).ToListAsync();
        Assert.Equal(2, linked.Count);
        Assert.All(linked, i => Assert.Equal("Pessoas atendidas", i.Name));
    }

    [Fact]
    public async Task ArchivedNationalOneIsNotOfferedButKeepsExistingLinks()
    {
        var f = await TwoNucleos.CreateAsync();
        var kept = await CreateNationalAsync(f, "Familias atendidas", "familias");
        var archived = await CreateNationalAsync(f, "Banheiros construidos", "un.");
        var linked = await LinkAsync(f, f.A, kept.Id, 1);

        await using (var db = f.Context(National))
        {
            var service = new NationalIndicatorService(db);
            await service.SetArchivedAsync(archived.Id, true);
            await service.SetArchivedAsync(kept.Id, true);
        }

        // Nucleo ve so os ativos e nao liga indicador novo a um arquivado...
        await using var nucleoDb = f.Context(f.A.Admin);
        Assert.Empty(await new NationalIndicatorService(nucleoDb).ListAsync(includeArchived: false));
        await Assert.ThrowsAsync<AppException>(() => LinkAsync(f, f.A, archived.Id, 2));

        // ...mas o que ja estava ligado continua atualizando o valor.
        var updated = await new IndicatorService(nucleoDb).UpdateAsync(linked.Id, new SaveIndicatorRequest
        {
            Name = linked.Name, Value = 2, NationalIndicatorId = kept.Id
        });
        Assert.Equal(2, updated.Value);
    }
}
