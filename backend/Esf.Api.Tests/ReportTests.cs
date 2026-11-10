using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Tela Relatorios: o que cada projeto tem no periodo (as mesmas regras do PDF), a ordem fixa dos projetos e o formato
/// Resumo.
/// </summary>
public class ReportTests
{
    private static ReportService Service(Data.EsfDbContext db) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())), NullLogger<ReportService>.Instance);

    private static ProjectFile Image(Guid projectId, Guid updateId, string name) => new()
    {
        ProjectId = projectId,
        ProjectUpdateId = updateId,
        FileName = name,
        StoredName = $"{Guid.NewGuid():N}-{name}",
        ContentType = "image/jpeg",
        SizeBytes = 1000
    };

    [Fact]
    public async Task PeriodCountsFollowThePdfRules()
    {
        var f = await TwoNucleos.CreateAsync();
        var project = f.A.ProjectId;

        await using (var db = f.SystemContext())
        {
            var withPhotos = new ProjectUpdate { ProjectId = project, Text = "<p>Mutirao</p>", HappenedOn = new DateOnly(2020, 7, 10) };
            // Sem HappenedOn vale o dia de Brasilia da publicacao: 23:30 de 30/09 (02:30 de 01/10 em UTC) e setembro.
            var lateNight = new ProjectUpdate { ProjectId = project, Text = "<p>Noite</p>", CreatedAt = new DateTime(2020, 10, 1, 2, 30, 0, DateTimeKind.Utc) };
            var after = new ProjectUpdate { ProjectId = project, Text = "<p>Depois</p>", HappenedOn = new DateOnly(2020, 10, 2) };
            db.AddRange(withPhotos, lateNight, after);

            // Cinco fotos e um PDF: o relatorio leva ate 4 fotos por registro.
            for (var i = 0; i < 5; i++)
                db.Add(Image(project, withPhotos.Id, $"foto{i}.jpg"));
            db.Add(new ProjectFile
            {
                ProjectId = project, ProjectUpdateId = withPhotos.Id, FileName = "ata.pdf", StoredName = "ata.pdf",
                ContentType = "application/pdf", SizeBytes = 1000
            });

            db.AddRange(
                new Activity
                {
                    ProjectId = project, Title = "Concluida em agosto", Status = ActivityStatus.Concluida,
                    CompletedAt = new DateTime(2020, 8, 15, 12, 0, 0, DateTimeKind.Utc)
                },
                // 00:30 de 01/10 em Brasilia: ja e outubro.
                new Activity
                {
                    ProjectId = project, Title = "Concluida em outubro", Status = ActivityStatus.Concluida,
                    CompletedAt = new DateTime(2020, 10, 1, 3, 30, 0, DateTimeKind.Utc)
                });
            await db.SaveChangesAsync();
        }

        await using var context = f.Context(f.A.Admin);
        var service = Service(context);

        var quarter = await service.PeriodCountsAsync(new DateOnly(2020, 7, 1), new DateOnly(2020, 9, 30));
        var counts = Assert.Single(quarter);
        Assert.Equal(project, counts.ProjectId);
        Assert.Equal(2, counts.Updates);
        Assert.Equal(4, counts.Photos);
        Assert.Equal(1, counts.Tasks);

        // Sem periodo, todo o historico (inclusive o registro da criacao do nucleo).
        var all = Assert.Single(await service.PeriodCountsAsync(null, null));
        Assert.Equal(4, all.Updates);
        Assert.Equal(2, all.Tasks);

        // Projeto sem nada no periodo aparece com zero.
        var empty = Assert.Single(await service.PeriodCountsAsync(new DateOnly(2019, 1, 1), new DateOnly(2019, 12, 31)));
        Assert.Equal((0, 0, 0), (empty.Updates, empty.Photos, empty.Tasks));

        await Assert.ThrowsAsync<AppException>(() =>
            service.PeriodCountsAsync(new DateOnly(2020, 9, 30), new DateOnly(2020, 7, 1)));
    }

    [Fact]
    public void ProjectsFollowProgramAndNameNotTheClickOrder()
    {
        var water = new ProjectProgram { Name = "Água limpa" };
        var zoning = new ProjectProgram { Name = "Zeladoria" };
        var clicked = new[]
        {
            new Project { Name = "Praça", Program = zoning },
            new Project { Name = "beta", Program = water },
            new Project { Name = "Alfa", Program = water }
        };

        var ordered = ReportService.InReportOrder(clicked).Select(p => p.Name);

        Assert.Equal(new[] { "Alfa", "beta", "Praça" }, ordered);
    }

    [Fact]
    public async Task SummaryFormatGeneratesWithOneProject()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var db = f.SystemContext())
        {
            var national = new NationalIndicator { Name = "Pessoas beneficiadas", Unit = "pessoas" };
            db.AddRange(national,
                new Indicator { ProjectId = f.A.ProjectId, Name = national.Name, Unit = national.Unit, NationalIndicatorId = national.Id });
            await db.SaveChangesAsync();
        }

        await using var context = f.Context(f.A.Admin);
        var service = Service(context);

        var summary = await service.GenerateAsync(new ReportRequest
        {
            ProjectIds = { f.A.ProjectId },
            Format = ReportFormat.Resumo,
            From = new DateOnly(2020, 1, 1)
        }, "Admin");
        var full = await service.GenerateAsync(new ReportRequest { ProjectIds = { f.A.ProjectId } }, "Admin");

        Assert.True(summary.Content.Length > 0);
        Assert.True(full.Content.Length > 0);
        Assert.NotEqual(summary.Content.Length, full.Content.Length);
    }

    [Fact]
    public void NumbersUseBrazilianSeparatorsWhateverTheServerCulture()
    {
        Assert.Equal("1.234", TextHelpers.Number(1234));
        Assert.Equal("1.234.567,8", TextHelpers.Number(1234567.8m));
        Assert.Equal("10,57", TextHelpers.Number(10.57m));
        Assert.Equal("0", TextHelpers.Number(0));
        Assert.Equal("12", TextHelpers.Number(12.00m));
    }
}
