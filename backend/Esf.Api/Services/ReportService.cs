using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ReportService
{
    private const int MaxPhotosPerUpdate = 4;

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ILogger<ReportService> _logger;

    public ReportService(EsfDbContext db, FileStorageService storage, ILogger<ReportService> logger)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
    }

    public async Task<(byte[] Content, string FileName)> GenerateAsync(ReportRequest request, string generatedBy)
    {
        var ids = request.ProjectIds.Distinct().ToList();
        if (ids.Count == 0)
            throw new AppException("Selecione ao menos um projeto para gerar o relatório.");
        if (request.From.HasValue && request.To.HasValue && request.To < request.From)
            throw new AppException("O fim do período não pode ser antes do início.");

        var projects = await _db.Projects
            .AsNoTracking()
            .AsSplitQuery()
            .Include(p => p.Program)
            .Include(p => p.OwnerVolunteer)
            .Include(p => p.Volunteers).ThenInclude(pv => pv.Volunteer)
            .Include(p => p.Indicators)
            .Include(p => p.Updates).ThenInclude(u => u.Attachments)
            .Include(p => p.Activities).ThenInclude(a => a.AssignedVolunteer)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        if (projects.Count == 0)
            throw AppException.NotFound("Projeto");

        projects = InReportOrder(projects);
        var summary = request.Format == ReportFormat.Resumo;

        var organization = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync()
                           ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        var programIds = projects.Select(p => p.ProgramId).Distinct().ToList();
        var templates = await _db.ProgramTemplateIndicators
            .AsNoTracking()
            .Where(t => programIds.Contains(t.ProgramId))
            .OrderBy(t => t.Position)
            .ToListAsync();
        var partners = await _db.ProgramPartners
            .AsNoTracking()
            .Where(x => programIds.Contains(x.ProgramId))
            .OrderBy(x => x.Position)
            .Select(x => new { x.ProgramId, x.Name, x.Role })
            .ToListAsync();

        // Indicadores pelo historico: o valor no fim do periodo e o da vespera do inicio (quanto mudou nele).
        var indicators = projects.SelectMany(p => p.Indicators).ToList();
        var indicatorIds = indicators.Select(i => i.Id).ToList();
        var history = await _db.IndicatorValueChanges
            .AsNoTracking()
            .Where(c => indicatorIds.Contains(c.IndicatorId))
            .ToListAsync();
        var figures = IndicatorHistory.Figures(indicators, history, request.From, request.To, Mapping.Today);

        var model = new ReportModel
        {
            Organization = organization,
            Logo = await LogoAsync(organization),
            Projects = projects,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            GeneratedBy = generatedBy,
            GeneratedAt = DateTime.UtcNow,
            IncludeVolunteers = request.IncludeVolunteers,
            IncludeIndicators = request.IncludeIndicators,
            IncludeUpdates = request.IncludeUpdates,
            IncludePhotos = request.IncludePhotos,
            IncludeTasks = request.IncludeTasks,
            Summary = summary,
            From = request.From,
            To = request.To,
            ProgramResults = ProgramResults(projects, templates, figures),
            Figures = figures,
            Partners = partners
                .GroupBy(x => x.ProgramId)
                .ToDictionary(g => g.Key, g => g.Select(x => new ReportPartner(x.Name, x.Role)).ToList()),
            Hours = await ProjectHoursService.TotalsAsync(_db, ids, request.From, request.To)
        };

        // Fotos ficam atreladas a atualizacao (ProjectUpdate) que as recebeu, nao ao projeto todo -
        // assim cada entrada da linha do tempo mostra exatamente as fotos daquele evento.
        // No resumo nao ha linha do tempo, entao as fotos nem sao lidas.
        var photos = model.Photos;
        if (request.IncludePhotos && !summary)
        {
            foreach (var update in projects.SelectMany(p => p.Updates).Where(u => model.InPeriod(u.Day)))
            {
                var images = update.Attachments
                    .Where(f => IsReportPhoto(f.ContentType, f.SizeBytes, f.StoredName))
                    .OrderBy(f => f.UploadedAt)
                    .Take(MaxPhotosPerUpdate)
                    .ToList();

                var loaded = new List<ReportPhoto>();
                foreach (var image in images)
                {
                    var bytes = await _storage.TryReadAsync(image.StoredName);
                    if (bytes is not { Length: > 0 }) continue;

                    var caption = string.IsNullOrWhiteSpace(image.Description) ? null : image.Description.Trim();
                    loaded.Add(new ReportPhoto(caption, ReportImageProcessor.Compress(bytes)));
                }

                if (loaded.Count > 0) photos[update.Id] = loaded;
            }
        }

        byte[] content;
        try
        {
            content = ProjectReportBuilder.Build(model);
        }
        catch (Exception ex) when (photos.Count > 0)
        {
            // Uma imagem invalida nao deve impedir a prestacao de contas: refaz sem fotos.
            _logger.LogWarning(ex, "Falha ao gerar o relatorio com fotos. Gerando versao sem imagens.");

            content = ProjectReportBuilder.Build(model with { IncludePhotos = false, Photos = new() });
        }

        return (content, FileName(model));
    }

    /// <summary>
    /// "relatorio-banheiro-direito-da-gente-2026-t3.pdf": o projeto ou o programa (varios programas: "projetos") e o
    /// periodo (mes, trimestre, ano ou as datas; sem periodo, o dia).
    /// </summary>
    public static string FileName(ReportModel model)
    {
        var subject = model.Projects.Count == 1
            ? model.Projects[0].Name
            : model.SingleProgram?.Name ?? "projetos";
        var slug = TextHelpers.Slug(subject);
        if (slug.Length > 60) slug = slug[..60].Trim('-');
        return $"relatorio-{slug}-{ReportPeriod.FileSuffix(model.From, model.To, TextHelpers.BrasiliaDay(model.GeneratedAt))}.pdf";
    }

    /// <summary>Logo do nucleo, quando ha e e uma imagem que o PDF desenha (senao o relatorio sai sem ele).</summary>
    private async Task<byte[]?> LogoAsync(Organization organization)
    {
        if (string.IsNullOrWhiteSpace(organization.LogoUrl)) return null;
        var bytes = await _storage.TryReadAsync(Path.GetFileName(organization.LogoUrl));
        return bytes is { Length: > 0 } && ReportImageProcessor.CanDraw(bytes) ? bytes : null;
    }

    /// <summary>
    /// Resultados por programa, na ordem dos projetos, pela regra unica (ResultTotals): os nacionais e os indicadores
    /// padrao do modelo somados nos projetos do relatorio, com os valores do fim do periodo (figures). Resultado que
    /// nenhum projeto informou fica de fora (vazio nao e zero e nao vai para o PDF); programa sem nenhum continua na
    /// lista, pelos parceiros. A mudanca no periodo e a mesma soma feita com os valores da vespera do inicio.
    /// </summary>
    public static List<ReportProgramResults> ProgramResults(
        List<Project> projects,
        List<ProgramTemplateIndicator> templates,
        Dictionary<Guid, IndicatorFigure> figures) =>
        projects
            .GroupBy(p => p.ProgramId)
            .Select(group =>
            {
                var indicators = group.SelectMany(p => p.Indicators).ToList();
                var programTemplates = templates
                    .Where(t => t.ProgramId == group.Key)
                    .Select(t => new ResultTotals.Template(t.Name, t.Unit, t.NationalIndicatorId))
                    .ToList();
                IndicatorFigure Figure(Indicator i) =>
                    figures.TryGetValue(i.Id, out var figure) ? figure : new IndicatorFigure(i.Value, i.ValueUpdatedAt, null);
                List<ResultTotals.Total> Sum(Func<IndicatorFigure, decimal?> value) => ResultTotals.Compute(
                    indicators.Select(i =>
                        new ResultTotals.Item(i.ProjectId, i.Name, i.Unit, value(Figure(i)), i.NationalIndicatorId, i.Target)),
                    programTemplates);

                // As duas somas tem os mesmos resultados na mesma ordem (a ordem so depende dos nomes).
                var results = Sum(f => f.Value)
                    .Zip(Sum(f => f.Start), (end, start) => (End: end, Start: start))
                    .Where(r => r.End.Value != null)
                    .Select(r => new ReportResult(r.End.Name, r.End.Unit, r.End.Value!.Value, r.End.Informed,
                        r.End.Projects, r.End.Value!.Value - (r.Start.Value ?? 0), r.End.Target))
                    .ToList();

                return new ReportProgramResults(group.Key, group.First().Program!.Name, group.Count(), results);
            })
            .ToList();

    /// <summary>
    /// Quanto cada projeto tem no periodo (todos os projetos do nucleo, inclusive arquivados): registros de andamento
    /// pelo dia em que aconteceram, fotos pelas mesmas regras do PDF (ate 4 por registro) e tarefas concluidas.
    /// </summary>
    public async Task<List<ReportPeriodCountDto>> PeriodCountsAsync(DateOnly? from, DateOnly? to)
    {
        if (from.HasValue && to.HasValue && to < from)
            throw new AppException("O fim do período não pode ser antes do início.");

        // O periodo ja filtra no banco (dia do registro = HappenedOn ou o dia de Brasilia da publicacao); a conta final
        // usa a mesma regra do PDF.
        var updateQuery = _db.ProjectUpdates.AsNoTracking();
        var taskQuery = _db.Activities.AsNoTracking()
            .Where(a => a.Status == ActivityStatus.Concluida && a.CompletedAt != null);
        if (from is { } start)
        {
            var startUtc = TextHelpers.BrasiliaDayStartUtc(start);
            updateQuery = updateQuery.Where(u => u.HappenedOn >= start || (u.HappenedOn == null && u.CreatedAt >= startUtc));
            taskQuery = taskQuery.Where(a => a.CompletedAt >= startUtc);
        }
        if (to is { } end)
        {
            var endUtc = TextHelpers.BrasiliaDayStartUtc(end.AddDays(1));
            updateQuery = updateQuery.Where(u => u.HappenedOn <= end || (u.HappenedOn == null && u.CreatedAt < endUtc));
            taskQuery = taskQuery.Where(a => a.CompletedAt < endUtc);
        }

        var updates = await updateQuery
            .Select(u => new
            {
                u.ProjectId,
                u.HappenedOn,
                u.CreatedAt,
                Files = u.Attachments.Select(f => new { f.ContentType, f.SizeBytes, f.StoredName }).ToList()
            })
            .ToListAsync();

        var tasks = await taskQuery
            .Select(a => new { a.ProjectId, a.CompletedAt })
            .ToListAsync();

        var projectIds = await _db.Projects.AsNoTracking().Select(p => p.Id).ToListAsync();

        var updatesInPeriod = updates
            .Where(u => ReportModel.InPeriod(u.HappenedOn ?? TextHelpers.BrasiliaDay(u.CreatedAt), from, to))
            .GroupBy(u => u.ProjectId)
            .ToDictionary(
                g => g.Key,
                g => (Count: g.Count(),
                    Photos: g.Sum(u => Math.Min(MaxPhotosPerUpdate,
                        u.Files.Count(f => IsReportPhoto(f.ContentType, f.SizeBytes, f.StoredName))))));
        var tasksInPeriod = tasks
            .Where(a => ReportModel.InPeriod(TextHelpers.BrasiliaDay(a.CompletedAt!.Value), from, to))
            .GroupBy(a => a.ProjectId)
            .ToDictionary(g => g.Key, g => g.Count());

        return projectIds
            .Select(id =>
            {
                var (count, photos) = updatesInPeriod.GetValueOrDefault(id);
                return new ReportPeriodCountDto(id, count, photos, tasksInPeriod.GetValueOrDefault(id));
            })
            .ToList();
    }

    /// <summary>
    /// Ordem fixa dos projetos no PDF, a mesma dos Resultados (por programa): programa e depois nome, sem diferenciar
    /// acento nem maiuscula. Nao depende da ordem em que a pessoa marcou.
    /// </summary>
    public static List<Project> InReportOrder(IEnumerable<Project> projects) =>
        projects
            .OrderBy(p => SearchText.Fold(p.Program!.Name), StringComparer.Ordinal)
            .ThenBy(p => SearchText.Fold(p.Name), StringComparer.Ordinal)
            .ToList();

    /// <summary>Foto que entra no PDF: imagem de ate 8 MB num formato que o QuestPDF desenha.</summary>
    private static bool IsReportPhoto(string contentType, long sizeBytes, string storedName) =>
        contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
        && sizeBytes < 8 * 1024 * 1024
        && Path.GetExtension(storedName).ToLowerInvariant() is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif";
}
