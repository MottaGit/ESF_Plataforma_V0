using System.Text;
using System.Text.Json;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Os servicos da fila em segundo plano, montados como no Program.cs, sobre o banco do teste.</summary>
internal static class JobServices
{
    public static ServiceProvider Create(DbContextOptions<EsfDbContext> options)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(Options.Create(new StorageOptions()));
        services.AddSingleton<JobSignal>();
        services.AddScoped<CurrentUserOverride>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<CurrentUserOverride>().User ?? TestUser.Anonymous);
        services.AddScoped(sp => new EsfDbContext(options, sp.GetRequiredService<ICurrentUser>()));
        services.AddScoped<FileStorageService>();
        services.AddScoped<ReportService>();
        services.AddScoped<SpreadsheetService>();
        services.AddScoped<SpreadsheetImportService>();
        services.AddScoped<JobQueue>();
        services.AddScoped<JobRunner>();
        services.AddSingleton<JobWorker>();
        return services.BuildServiceProvider();
    }

    /// <summary>Escopo como o de uma requisicao da pessoa logada.</summary>
    public static IServiceScope As(this IServiceProvider services, ICurrentUser user)
    {
        var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentUserOverride>().User = user;
        return scope;
    }

    public static JobQueue Queue(this IServiceScope scope) => scope.ServiceProvider.GetRequiredService<JobQueue>();
}

/// <summary>Fila de tarefas longas: quem pede, quem ve, em que nucleo roda, aviso, queda do servidor e limpeza.</summary>
public class BackgroundJobTests
{
    [Fact]
    public async Task ReportIsGeneratedInBackgroundAndOnlyTheRequesterDownloadsIt()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var worker = services.GetRequiredService<JobWorker>();

        BackgroundJobDto queued;
        using (var scope = services.As(f.A.Admin))
            queued = await scope.Queue().EnqueueAsync(BackgroundJobKind.Report, new ReportRequest { ProjectIds = { f.A.ProjectId } });
        Assert.Equal(BackgroundJobStatus.Queued, queued.Status);
        Assert.Equal(0, queued.Ahead);

        Assert.True(await worker.ProcessNextAsync());
        Assert.False(await worker.ProcessNextAsync());

        using (var scope = services.As(f.A.Admin))
        {
            var done = await scope.Queue().GetAsync(queued.Id);
            Assert.Equal(BackgroundJobStatus.Done, done.Status);
            Assert.EndsWith(".pdf", done.FileName);

            var (content, contentType, fileName) = await scope.Queue().DownloadAsync(queued.Id);
            Assert.Equal("%PDF", Encoding.ASCII.GetString(content, 0, 4));
            Assert.Equal("application/pdf", contentType);
            Assert.Equal(done.FileName, fileName);
            Assert.Equal(queued.Id, Assert.Single(await scope.Queue().ListMineAsync(new[] { BackgroundJobKind.Report })).Id);
        }

        // Outra pessoa do mesmo nucleo e o administrador do outro nucleo nao acham a tarefa.
        var colleague = new TestUser { Id = Guid.NewGuid(), Role = UserRole.Administrador, OrganizationId = f.A.OrganizationId };
        foreach (var other in new ICurrentUser[] { colleague, f.B.Admin })
        {
            using var scope = services.As(other);
            Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => scope.Queue().GetAsync(queued.Id))).StatusCode);
            Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => scope.Queue().DownloadAsync(queued.Id))).StatusCode);
            Assert.Empty(await scope.Queue().ListMineAsync(new[] { BackgroundJobKind.Report }));
        }

        // O PDF fica privado: nao sai por /uploads.
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
            db.AllOrganizations = true;
            var stored = (await db.BackgroundJobs.SingleAsync(j => j.Id == queued.Id)).ResultStoredName!;
            Assert.Null(await scope.ServiceProvider.GetRequiredService<FileStorageService>().FindAsync(stored));
        }
    }

    [Fact]
    public async Task JobRunsInTheNucleoOfWhoAsked()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);

        // A rota recusa antes de entrar na fila...
        using (var scope = services.As(f.B.Admin))
        {
            var reports = scope.ServiceProvider.GetRequiredService<ReportService>();
            await Assert.ThrowsAsync<AppException>(() => reports.ValidateAsync(new ReportRequest { ProjectIds = { f.A.ProjectId } }));
        }

        // ...e, mesmo que o pedido entre, a tarefa roda com o filtro do nucleo de quem pediu.
        BackgroundJobDto queued;
        using (var scope = services.As(f.B.Admin))
            queued = await scope.Queue().EnqueueAsync(BackgroundJobKind.Report, new ReportRequest { ProjectIds = { f.A.ProjectId } });
        Assert.True(await services.GetRequiredService<JobWorker>().ProcessNextAsync());

        using (var scope = services.As(f.B.Admin))
        {
            var failed = await scope.Queue().GetAsync(queued.Id);
            Assert.Equal(BackgroundJobStatus.Failed, failed.Status);
            Assert.Equal("Projeto não encontrado.", failed.Error);
        }

        await using var system = f.SystemContext();
        Assert.Equal(f.B.OrganizationId, (await system.BackgroundJobs.SingleAsync(j => j.Id == queued.Id)).OrganizationId);
    }

    [Fact]
    public async Task BellGetsTheNoticeOnlyWhenTheRequesterLeftTheScreen()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var worker = services.GetRequiredService<JobWorker>();
        var request = new ReportRequest { ProjectIds = { f.A.ProjectId } };

        // Ainda olhando a tela (perguntou agora ha pouco): sem aviso.
        using (var scope = services.As(f.A.Admin))
            await scope.Queue().EnqueueAsync(BackgroundJobKind.Report, request);
        await worker.ProcessNextAsync();

        // Saiu da tela: aviso no sininho.
        Guid left;
        using (var scope = services.As(f.A.Admin))
            left = (await scope.Queue().EnqueueAsync(BackgroundJobKind.Report, request)).Id;
        await using (var system = f.SystemContext())
        {
            (await system.BackgroundJobs.SingleAsync(j => j.Id == left)).LastSeenAt = DateTime.UtcNow.AddMinutes(-5);
            await system.SaveChangesAsync();
        }
        await worker.ProcessNextAsync();

        await using var check = f.SystemContext();
        var notice = Assert.Single(await check.Notifications.Where(n => n.Type == NotificationType.ReportFinished).ToListAsync());
        Assert.Equal(f.A.VolunteerId, notice.VolunteerId);
        Assert.Equal("Seu relatório ficou pronto.", notice.Message);
        Assert.EndsWith(".pdf", notice.Context);
    }

    [Fact]
    public async Task InterruptedJobGoesBackToTheQueueOnceAndThenFails()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var worker = services.GetRequiredService<JobWorker>();
        var now = DateTime.UtcNow;

        var job = new BackgroundJob
        {
            OrganizationId = f.A.OrganizationId, Kind = BackgroundJobKind.Report, Status = BackgroundJobStatus.Running,
            RequestedByUserId = f.A.AdminUserId, RequestedByName = "Admin", Attempts = 1, LeaseUntil = now.AddMinutes(-1),
            LastSeenAt = now
        };
        await using (var system = f.SystemContext())
        {
            system.BackgroundJobs.Add(job);
            await system.SaveChangesAsync();
        }

        // Com prazo em dia, nada muda.
        await worker.RecoverAbandonedAsync(now.AddMinutes(-2));
        Assert.Equal(BackgroundJobStatus.Running, await StatusAsync(f, job.Id));

        await worker.RecoverAbandonedAsync(now);
        Assert.Equal(BackgroundJobStatus.Queued, await StatusAsync(f, job.Id));

        // Caiu de novo na segunda tentativa: falha com explicacao.
        await using (var system = f.SystemContext())
        {
            var again = await system.BackgroundJobs.SingleAsync(j => j.Id == job.Id);
            again.Status = BackgroundJobStatus.Running;
            again.Attempts = 2;
            again.LeaseUntil = now.AddMinutes(-1);
            await system.SaveChangesAsync();
        }
        await worker.RecoverAbandonedAsync(now);
        await using var check = f.SystemContext();
        var failed = await check.BackgroundJobs.SingleAsync(j => j.Id == job.Id);
        Assert.Equal(BackgroundJobStatus.Failed, failed.Status);
        Assert.StartsWith("A geração foi interrompida", failed.Error);
    }

    [Fact]
    public async Task OldJobsAreDeletedWithTheirFiles()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var now = DateTime.UtcNow;

        BackgroundJob Job(DateTime createdAt, string file) => new()
        {
            OrganizationId = f.A.OrganizationId, Kind = BackgroundJobKind.Report, Status = BackgroundJobStatus.Done,
            RequestedByUserId = f.A.AdminUserId, RequestedByName = "Admin", CreatedAt = createdAt,
            ResultStoredName = file, ResultFileName = "relatorio.pdf"
        };
        var old = Job(now.AddDays(-8), "antigo.pdf");
        var recent = Job(now.AddDays(-1), "recente.pdf");
        await using (var system = f.SystemContext())
        {
            system.BackgroundJobs.AddRange(old, recent);
            foreach (var name in new[] { "antigo.pdf", "recente.pdf" })
                system.StoredFiles.Add(new StoredFile { StoredName = name, ContentType = "application/pdf", Content = new byte[] { 1 }, IsPrivate = true });
            await system.SaveChangesAsync();
        }

        await services.GetRequiredService<JobWorker>().CleanupAsync(now);

        await using var check = f.SystemContext();
        Assert.False(await check.BackgroundJobs.AnyAsync(j => j.Id == old.Id));
        Assert.True(await check.BackgroundJobs.AnyAsync(j => j.Id == recent.Id));
        Assert.Equal(new[] { "recente.pdf" }, await check.StoredFiles.Select(s => s.StoredName).ToListAsync());
    }

    [Fact]
    public async Task SpreadsheetsGoThroughTheQueueInTheNucleoOfWhoAsked()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var worker = services.GetRequiredService<JobWorker>();

        // Exportacao: arquivo para baixar e registro no historico em nome de quem pediu, no nucleo dela.
        Guid export;
        using (var scope = services.As(f.B.Admin))
            export = (await scope.Queue().EnqueueAsync(BackgroundJobKind.SpreadsheetExport,
                new ExportSpreadsheetRequest { Projects = true, Volunteers = true })).Id;
        Assert.True(await worker.ProcessNextAsync());
        using (var scope = services.As(f.B.Admin))
        {
            var (content, _, fileName) = await scope.Queue().DownloadAsync(export);
            Assert.EndsWith(".xlsx", fileName);
            Assert.Equal("PK", Encoding.ASCII.GetString(content, 0, 2));
        }
        await using (var system = f.SystemContext())
        {
            var entry = await system.AuditEntries.SingleAsync(e => e.Action == AuditAction.Exported);
            Assert.Equal((f.B.OrganizationId, f.B.AdminUserId), (entry.OrganizationId, entry.UserId));
        }

        // Importacao: conferencia e gravacao, com o arquivo guardado no pedido e apagado no fim.
        byte[] template;
        await using (var db = f.Context(f.B.Admin))
            template = (await new SpreadsheetService(db, f.B.Admin).TemplateAsync()).Content;
        var file = SpreadsheetTests.Fill(template, Esf.Api.Spreadsheets.SpreadsheetLayout.ProjectsSheet,
            new Dictionary<string, ClosedXML.Excel.XLCellValue>
            {
                ["Programa*"] = "Horta da Lomba", ["Situação*"] = "Em andamento", ["Data de início*"] = "01/02/2024"
            });

        async Task<ImportResultDto> ImportAsync(bool confirm)
        {
            Guid id;
            using (var scope = services.As(f.B.Admin))
            {
                var stream = new MemoryStream(file);
                id = (await scope.Queue().EnqueueAsync(BackgroundJobKind.SpreadsheetImport,
                    new SpreadsheetImportJob(confirm, "planilha.xlsx"),
                    new Microsoft.AspNetCore.Http.FormFile(stream, 0, stream.Length, "file", "planilha.xlsx")
                    {
                        Headers = new Microsoft.AspNetCore.Http.HeaderDictionary(),
                        ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    })).Id;
            }
            Assert.True(await worker.ProcessNextAsync());
            using (var scope = services.As(f.B.Admin))
            {
                var done = await scope.Queue().GetAsync(id);
                Assert.Equal(BackgroundJobStatus.Done, done.Status);
                return done.Result!.Value.Deserialize<ImportResultDto>(JobQueue.Json)!;
            }
        }

        var preview = await ImportAsync(confirm: false);
        Assert.Equal(1, preview.Projects!.New);
        Assert.False(preview.Applied);
        Assert.True((await ImportAsync(confirm: true)).Applied);

        await using var check = f.SystemContext();
        var created = await check.Projects.SingleAsync(p => p.Name == "Horta da Lomba");
        Assert.Equal(f.B.OrganizationId, created.OrganizationId);
        Assert.All(await check.BackgroundJobs.Where(j => j.Kind == BackgroundJobKind.SpreadsheetImport).ToListAsync(),
            j => Assert.Null(j.InputStoredName));
        Assert.DoesNotContain(await check.StoredFiles.ToListAsync(), s => s.StoredName.EndsWith(".xlsx") && s.IsPrivate
            && s.SizeBytes == file.Length);
    }

    [Fact]
    public async Task HistoryIsWrittenInTheNameOfWhoAskedTheJob()
    {
        var f = await TwoNucleos.CreateAsync();
        var options = new DbContextOptionsBuilder<EsfDbContext>(f.Options).AddInterceptors(new AuditInterceptor()).Options;
        var requester = new JobUser(f.A.AdminUserId, "Admin a", UserRole.Administrador, f.A.OrganizationId);

        await using (var db = new EsfDbContext(options, requester))
        {
            (await db.Projects.SingleAsync()).Name = "Projeto renomeado na fila";
            await db.SaveChangesAsync();
        }

        await using var check = f.Context(f.A.Admin);
        var entry = await check.AuditEntries.SingleAsync(e => e.EntityType == "Projeto" && e.UserId == f.A.AdminUserId);
        Assert.Equal(f.A.OrganizationId, entry.OrganizationId);
    }

    private static async Task<BackgroundJobStatus> StatusAsync(TwoNucleos f, Guid id)
    {
        await using var system = f.SystemContext();
        return (await system.BackgroundJobs.SingleAsync(j => j.Id == id)).Status;
    }
}
