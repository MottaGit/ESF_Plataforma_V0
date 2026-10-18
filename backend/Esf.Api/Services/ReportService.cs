using Esf.Api.Common;
using Esf.Api.Data;
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
            throw new AppException("Selecione ao menos um projeto para gerar o relatorio.");

        var projects = await _db.Projects
            .AsNoTracking()
            .Include(p => p.Program)
            .Include(p => p.OwnerVolunteer)
            .Include(p => p.Volunteers).ThenInclude(pv => pv.Volunteer)
            .Include(p => p.Indicators)
            .Include(p => p.Updates).ThenInclude(u => u.Attachments)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        if (projects.Count == 0)
            throw AppException.NotFound("Projeto");

        projects = projects.OrderBy(p => ids.IndexOf(p.Id)).ToList();

        var organization = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync()
                           ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        // Fotos ficam atreladas a atualizacao (ProjectUpdate) que as recebeu, nao ao projeto todo -
        // assim cada entrada da linha do tempo mostra exatamente as fotos daquele evento.
        var photos = new Dictionary<Guid, List<ReportPhoto>>();
        if (request.IncludePhotos)
        {
            foreach (var update in projects.SelectMany(p => p.Updates))
            {
                var images = update.Attachments
                    .Where(f => f.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    .Where(f => f.SizeBytes < 8 * 1024 * 1024)
                    .Where(f => IsSupportedImage(f.StoredName))
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

        var model = new ReportModel
        {
            Organization = organization,
            Projects = projects,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            GeneratedBy = generatedBy,
            GeneratedAt = DateTime.UtcNow,
            IncludeVolunteers = request.IncludeVolunteers,
            IncludeIndicators = request.IncludeIndicators,
            IncludeUpdates = request.IncludeUpdates,
            IncludePhotos = request.IncludePhotos,
            Photos = photos
        };

        byte[] content;
        try
        {
            content = ProjectReportBuilder.Build(model);
        }
        catch (Exception ex) when (photos.Count > 0)
        {
            // Uma imagem invalida nao deve impedir a prestacao de contas: refaz sem fotos.
            _logger.LogWarning(ex, "Falha ao gerar o relatorio com fotos. Gerando versao sem imagens.");

            var fallback = new ReportModel
            {
                Organization = model.Organization,
                Projects = model.Projects,
                Note = model.Note,
                GeneratedBy = model.GeneratedBy,
                GeneratedAt = model.GeneratedAt,
                IncludeVolunteers = model.IncludeVolunteers,
                IncludeIndicators = model.IncludeIndicators,
                IncludeUpdates = model.IncludeUpdates,
                IncludePhotos = false
            };

            content = ProjectReportBuilder.Build(fallback);
        }

        var fileName = projects.Count == 1
            ? $"relatorio-{Slug(projects[0].Name)}-{DateTime.UtcNow:yyyyMMdd}.pdf"
            : $"relatorio-projetos-{DateTime.UtcNow:yyyyMMdd}.pdf";

        return (content, fileName);
    }

    private static bool IsSupportedImage(string storedName)
    {
        var extension = Path.GetExtension(storedName).ToLowerInvariant();
        return extension is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif";
    }

    private static string Slug(string value)
    {
        var chars = value.ToLowerInvariant()
            .Select(c => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : '-')
            .ToArray();

        var slug = new string(chars);
        while (slug.Contains("--")) slug = slug.Replace("--", "-");

        slug = slug.Trim('-');
        return slug.Length > 50 ? slug[..50].Trim('-') : slug;
    }
}
