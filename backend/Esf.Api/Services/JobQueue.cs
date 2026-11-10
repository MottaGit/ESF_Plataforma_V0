using System.Text.Json;
using System.Text.Json.Serialization;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Fila de tarefas longas (relatorio em PDF, planilha): grava o pedido e responde na hora; o JobWorker processa por
/// tras. So quem pediu ve a tarefa e baixa o resultado.
/// </summary>
public class JobQueue
{
    /// <summary>Por quanto tempo o resultado fica guardado para baixar de novo.</summary>
    public static readonly TimeSpan Retention = TimeSpan.FromDays(7);

    /// <summary>O mesmo formato da API (nomes em camelCase, enums como texto), para o pedido e a resposta guardados.</summary>
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly FileStorageService _storage;
    private readonly JobSignal _signal;

    public JobQueue(EsfDbContext db, ICurrentUser currentUser, FileStorageService storage, JobSignal signal)
    {
        _db = db;
        _currentUser = currentUser;
        _storage = storage;
        _signal = signal;
    }

    /// <summary>Poe na fila. As regras de acesso de cada tipo ja foram conferidas por quem chama (rota e servico).</summary>
    public async Task<BackgroundJobDto> EnqueueAsync<T>(BackgroundJobKind kind, T payload, IFormFile? input = null)
    {
        var job = new BackgroundJob
        {
            Kind = kind,
            RequestedByUserId = _currentUser.RequireId(),
            RequestedByName = Truncate(_currentUser.Name ?? "usuário da plataforma", 160),
            RequestedByRole = _currentUser.Role,
            Payload = JsonSerializer.Serialize(payload, Json),
            CreatedAt = DateTime.UtcNow,
            LastSeenAt = DateTime.UtcNow
        };
        if (input is not null) job.InputStoredName = (await _storage.SaveAsync(input, isPrivate: true)).StoredName;

        _db.BackgroundJobs.Add(job);
        await _db.SaveChangesAsync();
        _signal.WakeJobs();
        return await ToDtoAsync(job);
    }

    /// <summary>Situacao da tarefa. Perguntar conta como "a pessoa esta esperando" (sem aviso no sininho no fim).</summary>
    public async Task<BackgroundJobDto> GetAsync(Guid id)
    {
        var job = await FindMineAsync(id);
        var now = DateTime.UtcNow;
        if (job.LastSeenAt is null || now - job.LastSeenAt > TimeSpan.FromSeconds(5))
        {
            job.LastSeenAt = now;
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                // O JobWorker pegou ou terminou a tarefa no mesmo instante: vale o que ele gravou.
                _db.ChangeTracker.Clear();
                job = await FindMineAsync(id);
            }
        }

        return await ToDtoAsync(job);
    }

    /// <summary>As tarefas recentes de quem esta logado, as mais novas primeiro (lista "Gerados recentemente").</summary>
    public async Task<List<BackgroundJobDto>> ListMineAsync(IReadOnlyCollection<BackgroundJobKind> kinds)
    {
        var userId = _currentUser.RequireId();
        var since = DateTime.UtcNow - Retention;
        var jobs = await _db.BackgroundJobs.AsNoTracking()
            .Where(j => j.RequestedByUserId == userId && j.CreatedAt >= since && (kinds.Count == 0 || kinds.Contains(j.Kind)))
            .OrderByDescending(j => j.CreatedAt)
            .Take(10)
            .ToListAsync();

        var list = new List<BackgroundJobDto>();
        foreach (var job in jobs) list.Add(await ToDtoAsync(job));
        return list;
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> DownloadAsync(Guid id)
    {
        var job = await FindMineAsync(id, tracking: false);
        if (job.Status != BackgroundJobStatus.Done || job.ResultStoredName is null)
            throw new AppException("O arquivo ainda não está pronto.", StatusCodes.Status409Conflict);

        var content = await _storage.TryReadAsync(job.ResultStoredName)
                      ?? throw new AppException("O arquivo não está mais guardado. Gere de novo.", StatusCodes.Status404NotFound);
        var fileName = job.ResultFileName ?? Path.GetFileName(job.ResultStoredName);
        return (content, FileStorageService.ContentTypeFor(fileName), fileName);
    }

    private async Task<BackgroundJob> FindMineAsync(Guid id, bool tracking = true)
    {
        var userId = _currentUser.RequireId();
        var query = tracking ? _db.BackgroundJobs : _db.BackgroundJobs.AsNoTracking();
        return await query.FirstOrDefaultAsync(j => j.Id == id && j.RequestedByUserId == userId)
               ?? throw AppException.NotFound("Tarefa", feminine: true);
    }

    private async Task<BackgroundJobDto> ToDtoAsync(BackgroundJob job)
    {
        int? ahead = null;
        if (job.Status == BackgroundJobStatus.Queued)
        {
            // A fila e uma so para todos os nucleos: conta so quantas estao na frente (nenhum dado delas sai daqui).
            var previous = _db.AllOrganizations;
            _db.AllOrganizations = true;
            try
            {
                ahead = await _db.BackgroundJobs.CountAsync(j =>
                    (j.Status == BackgroundJobStatus.Queued && j.CreatedAt < job.CreatedAt) || j.Status == BackgroundJobStatus.Running);
            }
            finally
            {
                _db.AllOrganizations = previous;
            }
        }

        JsonElement? result = null;
        if (job.Result is not null)
        {
            using var document = JsonDocument.Parse(job.Result);
            result = document.RootElement.Clone();
        }

        return new BackgroundJobDto(job.Id, job.Kind, job.Status, ahead, job.ResultFileName, job.Error, result,
            job.CreatedAt, job.FinishedAt);
    }

    public static T ReadPayload<T>(BackgroundJob job) =>
        JsonSerializer.Deserialize<T>(job.Payload, Json)
        ?? throw new InvalidOperationException($"Pedido vazio na tarefa {job.Id}.");

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
