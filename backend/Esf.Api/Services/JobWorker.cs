using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>Acorda o JobWorker quando entra tarefa nova (sem isso, ele confere a fila de tempos em tempos).</summary>
public sealed class JobSignal
{
    private readonly SemaphoreSlim _jobs = new(0);

    public void WakeJobs()
    {
        if (_jobs.CurrentCount == 0) _jobs.Release();
    }

    public Task WaitJobsAsync(TimeSpan timeout, CancellationToken cancellationToken) =>
        _jobs.WaitAsync(timeout, cancellationToken);
}

/// <summary>O que a tarefa produziu: um arquivo para baixar e/ou uma resposta em JSON.</summary>
public record JobOutcome(byte[]? File = null, string? FileName = null, string? ResultJson = null);

/// <summary>
/// Processa a fila de tarefas longas, uma de cada vez (assim dois relatorios grandes nao somam memoria), dentro da
/// propria API. Cada tarefa roda num escopo novo com o nucleo, o perfil e o nome de quem pediu (filtro por nucleo,
/// historico de alteracoes). Se o servidor reiniciar no meio, a tarefa volta para a fila (no maximo duas tentativas).
/// Ao lado, uma segunda rotina gera a miniatura e a versao do PDF das fotos enviadas (ProcessNextPreviewAsync).
/// </summary>
public class JobWorker : BackgroundService
{
    /// <summary>Quanto tempo a tarefa fica "em uso" sem sinal de vida antes de voltar para a fila.</summary>
    public static readonly TimeSpan Lease = TimeSpan.FromMinutes(2);

    public const int MaxAttempts = 2;

    private static readonly TimeSpan Heartbeat = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan IdleWait = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PreviewIdleWait = TimeSpan.FromSeconds(5);

    /// <summary>Sem pergunta da tela ha mais que isso, a pessoa saiu: o aviso vai para o sininho.</summary>
    private static readonly TimeSpan Watching = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopes;
    private readonly JobSignal _signal;
    private readonly ILogger<JobWorker> _logger;
    private DateTime _nextCleanup = DateTime.MinValue;

    public JobWorker(IServiceScopeFactory scopes, JobSignal signal, ILogger<JobWorker> logger)
    {
        _scopes = scopes;
        _signal = signal;
        _logger = logger;
    }

    /// <summary>Duas filas independentes: as tarefas pedidas (relatorio, planilha) e as versoes das fotos enviadas.</summary>
    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(
            LoopAsync("tarefas", async () =>
            {
                var now = DateTime.UtcNow;
                if (now >= _nextCleanup)
                {
                    await CleanupAsync(now);
                    _nextCleanup = now.AddHours(1);
                }

                await RecoverAbandonedAsync(now);
                if (!await ProcessNextAsync(stoppingToken))
                    await _signal.WaitJobsAsync(IdleWait, stoppingToken);
            }, stoppingToken),
            // Fotos: uma de cada vez, sem esperar atras de um relatorio grande.
            LoopAsync("fotos", async () =>
            {
                if (!await ProcessNextPreviewAsync(stoppingToken))
                    await Task.Delay(PreviewIdleWait, stoppingToken);
            }, stoppingToken));

    private async Task LoopAsync(string name, Func<Task> step, CancellationToken stoppingToken)
    {
        await Task.Yield();
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await step();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na fila em segundo plano ({Fila}).", name);
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    /// <summary>
    /// A proxima foto enviada sem miniatura ganha a miniatura e a versao do PDF (Reports/ImagePreviews). Falso quando
    /// nao ha nenhuma esperando. As fotos antigas (de antes desta rotina) entram pelo mesmo caminho.
    /// </summary>
    public async Task<bool> ProcessNextPreviewAsync(CancellationToken stoppingToken = default)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
        db.AllOrganizations = true;

        var file = await db.ProjectFiles
            .Where(f => f.PreviewState == PreviewState.Pending)
            .OrderBy(f => f.UploadedAt)
            .FirstOrDefaultAsync(stoppingToken);
        if (file is null) return false;

        var original = await scope.ServiceProvider.GetRequiredService<FileStorageService>().TryReadAsync(file.StoredName);
        var previews = original is null ? null : ImagePreviews.Create(original);
        if (previews is { } made)
        {
            await PutStoredFileAsync(db, ImagePreviews.ThumbnailName(file.StoredName), made.Thumbnail);
            await PutStoredFileAsync(db, ImagePreviews.ReportName(file.StoredName), made.Report);
            file.PreviewState = PreviewState.Ready;
        }
        else
        {
            _logger.LogWarning("Nao foi possivel gerar a miniatura de {StoredName}; fica a original.", file.StoredName);
            file.PreviewState = PreviewState.Failed;
        }

        try
        {
            await db.SaveChangesAsync(stoppingToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // A foto foi apagada no meio: as versoes tambem nao entram (mesmo SaveChanges).
        }
        catch (DbUpdateException ex)
        {
            // Outro erro de gravacao: marca como falha para nao tentar a mesma foto sem parar.
            _logger.LogError(ex, "Nao foi possivel gravar a miniatura de {StoredName}.", file.StoredName);
            using var retry = _scopes.CreateScope();
            var retryDb = retry.ServiceProvider.GetRequiredService<EsfDbContext>();
            retryDb.AllOrganizations = true;
            var again = await retryDb.ProjectFiles.FirstOrDefaultAsync(f => f.Id == file.Id, stoppingToken);
            if (again is not null)
            {
                again.PreviewState = PreviewState.Failed;
                await retryDb.SaveChangesAsync(stoppingToken);
            }
        }

        return true;
    }

    private static async Task PutStoredFileAsync(EsfDbContext db, string storedName, byte[] content)
    {
        var existing = await db.StoredFiles.FirstOrDefaultAsync(f => f.StoredName == storedName);
        if (existing is null)
        {
            db.StoredFiles.Add(new StoredFile
            {
                StoredName = storedName,
                ContentType = "image/jpeg",
                SizeBytes = content.Length,
                Content = content,
                CreatedAt = DateTime.UtcNow
            });
            return;
        }

        existing.Content = content;
        existing.SizeBytes = content.Length;
    }

    /// <summary>Pega a proxima tarefa da fila e processa. Falso quando a fila esta vazia.</summary>
    public async Task<bool> ProcessNextAsync(CancellationToken stoppingToken = default)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
        db.AllOrganizations = true;
        var storage = scope.ServiceProvider.GetRequiredService<FileStorageService>();

        var job = await ClaimAsync(db);
        if (job is null) return false;

        using var heartbeat = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        var keepLease = KeepLeaseAsync(job.Id, job.Stamp, heartbeat.Token);

        JobOutcome? outcome = null;
        string? error = null;
        try
        {
            var input = job.InputStoredName is null ? null : await storage.TryReadAsync(job.InputStoredName);
            var run = RunAsRequesterAsync(job, input);
            if (await Task.WhenAny(run, Task.Delay(Timeout.Infinite, stoppingToken)) != run)
            {
                // Servidor desligando (deploy): devolve para a fila sem contar a tentativa; outro servidor continua.
                await ReleaseAsync(db, job);
                return true;
            }

            outcome = await run;
        }
        catch (AppException ex)
        {
            error = ex.Message;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "A tarefa {JobId} ({Kind}) falhou.", job.Id, job.Kind);
            error = "Não foi possível concluir. Tente de novo em instantes.";
        }
        finally
        {
            await heartbeat.CancelAsync();
            try
            {
                await keepLease;
            }
            catch (OperationCanceledException)
            {
                // fim do sinal de vida
            }
        }

        await FinishAsync(db, storage, job, outcome, error);
        return true;
    }

    /// <summary>Roda num escopo proprio, como quem pediu. O escopo so e descartado quando a tarefa termina.</summary>
    private Task<JobOutcome> RunAsRequesterAsync(BackgroundJob job, byte[]? input)
    {
        var scope = _scopes.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentUserOverride>().User =
            new JobUser(job.RequestedByUserId, job.RequestedByName, job.RequestedByRole, job.OrganizationId);
        var run = scope.ServiceProvider.GetRequiredService<JobRunner>().RunAsync(job, input);
        _ = run.ContinueWith(_ => scope.Dispose(), TaskScheduler.Default);
        return run;
    }

    private static async Task<BackgroundJob?> ClaimAsync(EsfDbContext db)
    {
        var job = await db.BackgroundJobs
            .Where(j => j.Status == BackgroundJobStatus.Queued)
            .OrderBy(j => j.CreatedAt)
            .FirstOrDefaultAsync();
        if (job is null) return null;

        var now = DateTime.UtcNow;
        job.Status = BackgroundJobStatus.Running;
        job.Stamp = Guid.NewGuid();
        job.Attempts++;
        job.StartedAt = now;
        job.LeaseUntil = now + Lease;
        try
        {
            await db.SaveChangesAsync();
            return job;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Outro servidor pegou a mesma tarefa primeiro.
            db.ChangeTracker.Clear();
            return null;
        }
    }

    /// <summary>Enquanto a tarefa roda, renova o prazo: se o servidor cair, o prazo vence e a tarefa volta para a fila.</summary>
    private async Task KeepLeaseAsync(Guid jobId, Guid stamp, CancellationToken cancellationToken)
    {
        while (true)
        {
            await Task.Delay(Heartbeat, cancellationToken);
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
                db.AllOrganizations = true;
                var job = await db.BackgroundJobs.FirstOrDefaultAsync(j => j.Id == jobId && j.Stamp == stamp, cancellationToken);
                if (job is null) return;
                job.LeaseUntil = DateTime.UtcNow + Lease;
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Nao foi possivel renovar o prazo da tarefa {JobId}.", jobId);
            }
        }
    }

    private static async Task ReleaseAsync(EsfDbContext db, BackgroundJob job)
    {
        job.Status = BackgroundJobStatus.Queued;
        job.Attempts = Math.Max(0, job.Attempts - 1);
        job.LeaseUntil = null;
        job.StartedAt = null;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // ja foi recuperada por outro servidor
        }
    }

    private async Task FinishAsync(EsfDbContext db, FileStorageService storage, BackgroundJob job, JobOutcome? outcome,
        string? error)
    {
        var now = DateTime.UtcNow;
        job.FinishedAt = now;
        job.LeaseUntil = null;
        if (outcome is not null)
        {
            job.Status = BackgroundJobStatus.Done;
            job.Result = outcome.ResultJson;
            if (outcome.File is not null)
            {
                var name = outcome.FileName ?? "arquivo";
                job.ResultStoredName = storage.SaveGenerated(outcome.File, Path.GetExtension(name), isPrivate: true).StoredName;
                job.ResultFileName = name;
            }
        }
        else
        {
            job.Status = BackgroundJobStatus.Failed;
            job.Error = Truncate(error ?? "Não foi possível concluir.", 500);
        }

        // O arquivo enviado (planilha a importar) nao serve mais.
        if (job.InputStoredName is { } input)
        {
            await RemoveStoredFileAsync(db, input);
            job.InputStoredName = null;
        }

        if (job.LastSeenAt is null || now - job.LastSeenAt > Watching)
            await NotifyAsync(db, job);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // O prazo venceu e outro servidor pegou a tarefa: o resultado deste fica de fora.
            _logger.LogWarning("A tarefa {JobId} foi retomada por outro servidor; resultado descartado.", job.Id);
        }
    }

    /// <summary>Aviso no sininho de quem pediu (se o acesso tem voluntario), para quem ja saiu da tela.</summary>
    private static async Task NotifyAsync(EsfDbContext db, BackgroundJob job)
    {
        // A conferencia da planilha (sem gravar) so vale com a janela aberta: sem aviso.
        if (job.Kind == BackgroundJobKind.SpreadsheetImport && !JobQueue.ReadPayload<SpreadsheetImportJob>(job).Confirm) return;

        var volunteerId = await db.Users.Where(u => u.Id == job.RequestedByUserId).Select(u => u.VolunteerId).FirstOrDefaultAsync();
        if (volunteerId is not { } recipient) return;

        var done = job.Status == BackgroundJobStatus.Done;
        var (type, message, context) = job.Kind switch
        {
            BackgroundJobKind.Report => (NotificationType.ReportFinished,
                done ? "Seu relatório ficou pronto." : $"Não foi possível gerar o relatório: {job.Error}", "Relatórios"),
            BackgroundJobKind.SpreadsheetExport => (NotificationType.SpreadsheetFinished,
                done ? "Sua planilha ficou pronta." : $"Não foi possível gerar a planilha: {job.Error}", "Configurações › Planilhas"),
            _ => (NotificationType.SpreadsheetFinished,
                done ? "A importação da planilha terminou." : $"A importação da planilha não terminou: {job.Error}", "Configurações › Planilhas")
        };

        db.Notifications.Add(new Notification
        {
            VolunteerId = recipient,
            Type = type,
            Message = Truncate(message, 400),
            Context = done ? job.ResultFileName ?? context : context,
            CreatedAt = DateTime.UtcNow
        });
    }

    /// <summary>Tarefa "em uso" com o prazo vencido (servidor caiu): volta para a fila ou, na segunda vez, falha.</summary>
    public async Task RecoverAbandonedAsync(DateTime now)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
        db.AllOrganizations = true;

        var stale = await db.BackgroundJobs
            .Where(j => j.Status == BackgroundJobStatus.Running && j.LeaseUntil < now)
            .ToListAsync();
        if (stale.Count == 0) return;

        foreach (var job in stale)
        {
            job.Stamp = Guid.NewGuid();
            job.LeaseUntil = null;
            if (job.Attempts >= MaxAttempts)
            {
                job.Status = BackgroundJobStatus.Failed;
                job.FinishedAt = now;
                job.Error = "A geração foi interrompida duas vezes (o servidor reiniciou no meio). Tente de novo; "
                            + "se acontecer outra vez, diminua o período ou o número de projetos.";
                await NotifyAsync(db, job);
            }
            else
            {
                job.Status = BackgroundJobStatus.Queued;
                job.StartedAt = null;
            }
        }

        try
        {
            await db.SaveChangesAsync();
            _logger.LogWarning("{Count} tarefa(s) interrompida(s) recuperada(s).", stale.Count);
        }
        catch (DbUpdateConcurrencyException)
        {
            // outro servidor recuperou ao mesmo tempo
        }
    }

    /// <summary>Apaga as tarefas (e os arquivos delas) depois do prazo de guarda.</summary>
    public async Task CleanupAsync(DateTime now)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EsfDbContext>();
        db.AllOrganizations = true;

        var limit = now - JobQueue.Retention;
        var old = await db.BackgroundJobs
            .Where(j => j.CreatedAt < limit && j.Status != BackgroundJobStatus.Running)
            .OrderBy(j => j.CreatedAt)
            .Take(200)
            .ToListAsync();
        if (old.Count == 0) return;

        foreach (var job in old)
        {
            if (job.ResultStoredName is { } result) await RemoveStoredFileAsync(db, result);
            if (job.InputStoredName is { } input) await RemoveStoredFileAsync(db, input);
            db.BackgroundJobs.Remove(job);
        }

        await db.SaveChangesAsync();
    }

    // Remove pelo contexto (e nao por ExecuteDelete) para entrar no mesmo SaveChanges da tarefa.
    private static async Task RemoveStoredFileAsync(EsfDbContext db, string storedName)
    {
        if (!await db.StoredFiles.AnyAsync(f => f.StoredName == storedName)) return;
        var stub = new StoredFile { StoredName = storedName };
        db.StoredFiles.Attach(stub);
        db.StoredFiles.Remove(stub);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..(max - 1)] + "…";
}
