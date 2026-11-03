using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Dados de demonstracao: dois nucleos separados, conta nacional e indicadores nacionais que somam.</summary>
public class DemoDataTests
{
    static DemoDataTests()
    {
        // Os termos assinados da demonstracao sao PDFs gerados na hora.
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
    }

    [Fact]
    public async Task DemoDataHasTwoSeparateNucleosAndTheNationalTotals()
    {
        var options = new DbContextOptionsBuilder<EsfDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using (var seed = new EsfDbContext(options))
            await DbSeeder.SeedAsync(seed, "Esf@2026", NullLogger.Instance);

        await using var system = new EsfDbContext(options) { AllOrganizations = true };
        var nucleos = await system.Organizations.OrderBy(o => o.Name).ToListAsync();
        Assert.Equal(new[] { "ESF Curitiba", "ESF Porto Alegre" }, nucleos.Select(o => o.Name));
        Assert.DoesNotContain(await system.Volunteers.ToListAsync(), v => v.OrganizationId == Guid.Empty);
        Assert.DoesNotContain(await system.Projects.ToListAsync(), p => p.OrganizationId == Guid.Empty);
        // Todo projeto tem os dois nacionais, uma vez cada (as hortas sem pessoas beneficiadas ficam em branco).
        var links = await system.Indicators.Where(i => i.NationalIndicatorId != null)
            .GroupBy(i => i.ProjectId).Select(g => g.Select(i => i.NationalIndicatorId).Distinct().Count()).ToListAsync();
        Assert.Equal(await system.Projects.CountAsync(), links.Count);
        Assert.All(links, count => Assert.Equal(2, count));
        Assert.Equal(2 * links.Count, await system.Indicators.CountAsync(i => i.NationalIndicatorId != null));
        Assert.Contains(await system.Indicators.ToListAsync(), i => i.NationalIndicatorId != null && i.Value == null);

        var national = await system.Users.SingleAsync(u => u.IsNational);
        Assert.Equal("nacional@esf.org.br", national.Email);
        Assert.Null(national.OrganizationId);

        // Cada administrador ve so o proprio nucleo.
        var poa = nucleos.Single(o => o.Name == "ESF Porto Alegre");
        var curitiba = nucleos.Single(o => o.Name == "ESF Curitiba");
        await using (var poaDb = new EsfDbContext(options, new TestUser { Role = UserRole.Administrador, OrganizationId = poa.Id }))
        {
            Assert.Equal(13, await poaDb.Volunteers.CountAsync());
            Assert.Equal(5, await poaDb.Projects.CountAsync());
        }
        await using (var curitibaDb = new EsfDbContext(options, new TestUser { Role = UserRole.Administrador, OrganizationId = curitiba.Id }))
        {
            Assert.Equal(4, await curitibaDb.Volunteers.CountAsync());
            Assert.Equal(2, await curitibaDb.Projects.CountAsync());
            Assert.Equal(3, await curitibaDb.SignedDocuments.CountAsync());
        }

        // Painel: os indicadores nacionais somam os dois nucleos (a horta de POA passou a "Famílias atendidas").
        var user = new TestUser { Id = national.Id, IsNational = true };
        await using var panelDb = new EsfDbContext(options, user);
        var jwt = new JwtTokenService(Options.Create(new JwtOptions { Key = new string('k', 40) }));
        var panel = await new NationalService(panelDb, new AccessService(panelDb, jwt, user), user).PanelAsync(null, null);
        Assert.Equal(48, panel.Indicators.Single(i => i.Name == "Famílias atendidas").Total);
        Assert.Equal(24, panel.Indicators.Single(i => i.Name == "Pessoas beneficiadas").Total);
        Assert.Equal(2, panel.Totals.Nucleos);
    }
}
