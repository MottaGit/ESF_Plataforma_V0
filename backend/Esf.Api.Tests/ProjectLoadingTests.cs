using Esf.Api.Common;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// O detalhe do projeto traz tarefas, equipe e indicadores (uma consulta por colecao: numa so, o banco devolveria uma
/// linha para cada combinacao; no PostgreSQL o TestDatabase reprova essa forma). Registros e arquivos, que so crescem,
/// vem pelas rotas proprias, os registros uma pagina por vez.
/// </summary>
public class ProjectLoadingTests
{
    private static ProjectService Service(Data.EsfDbContext db, TestUser user) => new(db, new NotificationService(db, user));

    private static FileStorageService Storage(Data.EsfDbContext db) =>
        new(db, Microsoft.Extensions.Options.Options.Create(new StorageOptions()));

    private static ProjectUpdateService Updates(Data.EsfDbContext db, TestUser user) => new(db, Storage(db), user);

    [Fact]
    public async Task DetailCountsRecordsAndFilesThatComeByTheirOwnRoutes()
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

        // O nucleo de teste ja tem um arquivo e um registro de cada tipo: confere pelas contagens do banco.
        var detail = await projects.GetDetailAsync(f.A.ProjectId);
        Assert.Equal(await db.ProjectUpdates.CountAsync(u => u.ProjectId == f.A.ProjectId), detail.UpdatesCount);
        Assert.Equal(await db.ProjectFiles.CountAsync(x => x.ProjectId == f.A.ProjectId), detail.FilesCount);
        Assert.True(detail.FilesCount >= 2);

        var files = await new ProjectFileService(db, Storage(db)).ListByProjectAsync(f.A.ProjectId);
        Assert.Contains(files, file => file.FileName == "planta.pdf");
        var page = await Updates(db, f.A.Admin).ListByProjectAsync(f.A.ProjectId);
        Assert.Equal("foto.jpg", Assert.Single(Assert.Single(page.Items, u => u.Id == update.Id).Attachments).FileName);

        var storedNames = await projects.DeleteAsync(f.A.ProjectId);
        Assert.Contains("planta.pdf", storedNames);
        Assert.Contains("foto.jpg", storedNames);
        Assert.False(await db.Projects.AnyAsync(p => p.Id == f.A.ProjectId));
    }

    [Fact]
    public async Task RecordsComeOnePageAtATimeByTheDayTheyHappened()
    {
        var f = await TwoNucleos.CreateAsync();
        var today = Mapping.Today;
        await using (var system = f.SystemContext())
        {
            system.ProjectUpdates.RemoveRange(system.ProjectUpdates.Where(u => u.ProjectId == f.A.ProjectId));
            for (var i = 0; i < 25; i++)
                system.ProjectUpdates.Add(new ProjectUpdate
                {
                    ProjectId = f.A.ProjectId, Text = $"<p>Dia {i}</p>", HappenedOn = today.AddDays(-i - 1),
                    CreatedAt = DateTime.UtcNow.AddMinutes(-i)
                });
            // Registro de antes do campo "quando aconteceu": vale o dia da publicacao (hoje), entao vem primeiro.
            system.ProjectUpdates.Add(new ProjectUpdate
            {
                ProjectId = f.A.ProjectId, Text = "<p>Antigo publicado hoje</p>", HappenedOn = null, CreatedAt = DateTime.UtcNow
            });
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var updates = Updates(db, f.A.Admin);

        var first = await updates.ListByProjectAsync(f.A.ProjectId);
        Assert.Equal(26, first.Total);
        Assert.Equal(ProjectUpdateService.DefaultPageSize, first.Items.Count);
        Assert.Contains("Antigo publicado hoje", first.Items[0].Text);
        Assert.Contains("Dia 0", first.Items[1].Text);

        var rest = await updates.ListByProjectAsync(f.A.ProjectId, skip: first.Items.Count);
        Assert.Equal(6, rest.Items.Count);
        Assert.Contains("Dia 24", rest.Items[^1].Text);
        Assert.Empty(first.Items.Select(u => u.Id).Intersect(rest.Items.Select(u => u.Id)));

        // De outro nucleo, o projeto nao existe.
        await using var other = f.Context(f.B.Admin);
        await Assert.ThrowsAsync<AppException>(() => Updates(other, f.B.Admin).ListByProjectAsync(f.A.ProjectId));
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
