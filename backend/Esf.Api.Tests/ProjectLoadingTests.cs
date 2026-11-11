using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// O projeto inteiro (detalhe e exclusao) vem em uma consulta por colecao. Numa so, o banco devolveria uma linha para
/// cada combinacao de tarefa, pessoa, indicador, arquivo e registro; no PostgreSQL o TestDatabase reprova essa forma.
/// </summary>
public class ProjectLoadingTests
{
    private static ProjectService Service(Data.EsfDbContext db, TestUser user) => new(db, new NotificationService(db, user));

    [Fact]
    public async Task DetailAndDeletionBringEveryFileAndRecordOfTheProject()
    {
        var f = await TwoNucleos.CreateAsync();
        var update = new ProjectUpdate { ProjectId = f.A.ProjectId, Text = "<p>Mutirao de sabado</p>" };
        await using (var system = f.SystemContext())
        {
            system.ProjectUpdates.Add(update);
            system.ProjectFiles.AddRange(
                new ProjectFile { ProjectId = f.A.ProjectId, FileName = "planta.pdf", StoredName = "planta.pdf", ContentType = "application/pdf" },
                new ProjectFile
                {
                    ProjectId = f.A.ProjectId, ProjectUpdateId = update.Id, FileName = "foto.jpg", StoredName = "foto.jpg",
                    ContentType = "image/jpeg"
                });
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var projects = Service(db, f.A.Admin);

        var detail = await projects.GetDetailAsync(f.A.ProjectId);
        // O nucleo de teste ja tem um arquivo e um registro de cada tipo: confere pelos nomes.
        Assert.Contains(detail.Files, file => file.FileName == "planta.pdf");
        Assert.Contains(detail.Files, file => file.FileName == "foto.jpg");
        Assert.Equal("foto.jpg", Assert.Single(Assert.Single(detail.Updates, u => u.Id == update.Id).Attachments).FileName);

        var storedNames = await projects.DeleteAsync(f.A.ProjectId);
        Assert.Contains("planta.pdf", storedNames);
        Assert.Contains("foto.jpg", storedNames);
        Assert.False(await db.Projects.AnyAsync(p => p.Id == f.A.ProjectId));
    }

    /// <summary>A regra do TestDatabase no PostgreSQL: duas colecoes numa consulta sem AsSplitQuery reprovam o teste.</summary>
    [PostgresFact]
    public async Task TwoCollectionsInOneQueryFailTheTest()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            db.Projects.Include(p => p.Activities).Include(p => p.Indicators).ToListAsync());
        Assert.NotEmpty(await db.Projects.Include(p => p.Activities).Include(p => p.Indicators).AsSplitQuery().ToListAsync());
    }
}
