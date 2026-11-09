using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Certificado de voluntariado, gerado na hora (nada fica salvo): periodo completo (do historico de status), um periodo
/// escolhido (com a carga semanal) ou a participacao num projeto (descricao, o que a pessoa fez e as horas lancadas).
/// </summary>
public class CertificateService
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp"
    };

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public CertificateService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    /// <summary>
    /// Total de horas do periodo: semanas (dias corridos, contando o primeiro e o ultimo) vezes a carga semanal,
    /// arredondado para baixo. De 07/10 a 31/12/2025 sao 86 dias = 12,3 semanas; com 6 h/semana, 73 horas.
    /// </summary>
    public static int TotalHours(DateOnly start, DateOnly end, int weeklyHours) =>
        (int)Math.Floor((end.DayNumber - start.DayNumber + 1) / 7.0 * weeklyHours);

    /// <summary>O que a janela do certificado mostra ja preenchido: o periodo completo e os projetos da pessoa.</summary>
    public async Task<CertificateOptionsDto> OptionsAsync(Guid volunteerId)
    {
        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId)) throw AppException.NotFound("Voluntário");
        return new CertificateOptionsDto(await FullPeriodAsync(volunteerId), await ProjectsAsync(volunteerId));
    }

    public async Task<(byte[] Content, string FileName)> GenerateAsync(Guid volunteerId, CertificateRequest request)
    {
        var volunteer = await _db.Volunteers.AsNoTracking().FirstOrDefaultAsync(v => v.Id == volunteerId)
                        ?? throw AppException.NotFound("Voluntário");
        var org = await _db.Organizations.AsNoTracking().OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync()
                  ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        CertificateText text;
        string fileName;
        switch (request.Kind)
        {
            case CertificateKind.Full:
            {
                var full = await FullPeriodAsync(volunteerId)
                           ?? throw new AppException("O histórico não tem nenhum período como Ativo: use um período específico.");
                text = CertificateText.General(full.WeeklyHours, TextHelpers.LongDate(full.Start), TextHelpers.LongDate(full.End),
                    full.Hours, org.City);
                fileName = $"certificado-{TextHelpers.Slug(volunteer.Name)}.pdf";
                break;
            }
            case CertificateKind.Project:
            {
                var (start, end) = Period(request);
                var project = await _db.Projects.AsNoTracking().Include(p => p.Program)
                                  .FirstOrDefaultAsync(p => p.Id == request.ProjectId)
                              ?? throw new AppException("Escolha o projeto do certificado.");
                var takesPart = await _db.ProjectVolunteers.AnyAsync(pv => pv.ProjectId == project.Id && pv.VolunteerId == volunteerId)
                                || await _db.ProjectHourEntries.AnyAsync(h => h.ProjectId == project.Id && h.VolunteerId == volunteerId);
                if (!takesPart) throw new AppException("Esta pessoa não participa do projeto escolhido.");

                decimal? hours = null;
                if (request.IncludeHours)
                {
                    var logged = await _db.ProjectHourEntries
                        .Where(h => h.ProjectId == project.Id && h.VolunteerId == volunteerId && h.Date >= start && h.Date <= end)
                        .Select(h => h.Hours)
                        .ToListAsync();
                    hours = logged.Count > 0 ? logged.Sum() : null;
                }

                var program = project.Program?.Name;
                text = CertificateText.ForProject(
                    project.Name,
                    string.IsNullOrWhiteSpace(program) || SearchText.Fold(program) == SearchText.Fold(project.Name) ? null : program,
                    project.City ?? org.City,
                    TextHelpers.LongDate(start),
                    TextHelpers.LongDate(end),
                    hours,
                    Clean(request.ProjectSummary, CertificateLimits.Summary),
                    Clean(request.Activities, CertificateLimits.Activities));
                fileName = $"certificado-{TextHelpers.Slug(volunteer.Name)}-{TextHelpers.Slug(project.Name)}.pdf";
                break;
            }
            default:
            {
                var (start, end) = Period(request);
                text = CertificateText.General(request.WeeklyHours, TextHelpers.LongDate(start), TextHelpers.LongDate(end),
                    TotalHours(start, end, request.WeeklyHours), org.City);
                fileName = $"certificado-{TextHelpers.Slug(volunteer.Name)}.pdf";
                break;
            }
        }

        var model = new CertificateModel(
            org.Name,
            org.Cnpj,
            volunteer.Name,
            FormatCpf(request.Cpf),
            text,
            org.SignatoryName,
            org.SignatoryRole,
            org.SignatoryNote,
            await ImageAsync(org.SignatureStoredName),
            await ImageAsync(org.LogoUrl?.Split('/').Last()));

        return (CertificateBuilder.Build(model), fileName);
    }

    // ---------- internos ----------

    private static (DateOnly Start, DateOnly End) Period(CertificateRequest request)
    {
        if (request.StartDate is null || request.EndDate is null) throw new AppException("Informe o início e o fim do período.");
        if (request.EndDate < request.StartDate) throw new AppException("O fim do período não pode ser antes do início.");
        return (request.StartDate.Value, request.EndDate.Value);
    }

    /// <summary>Do inicio do primeiro periodo como Ativo ao fim do ultimo (ou hoje), com as horas do historico.</summary>
    private async Task<CertificateFullPeriodDto?> FullPeriodAsync(Guid volunteerId)
    {
        var changes = await _db.VolunteerStatusChanges.AsNoTracking()
            .Where(c => c.VolunteerId == volunteerId)
            .OrderBy(c => c.StartsOn)
            .ToListAsync();
        var today = Mapping.Today;
        var active = VolunteerStatusHistoryService.Periods(changes)
            .Where(p => p.Status == VolunteerStatus.Ativo && p.StartsOn <= today)
            .ToList();
        if (active.Count == 0) return null;

        var end = active.Any(p => p.EndsOn is null) ? today : active.Max(p => p.EndsOn!.Value);
        var hours = VolunteerStatusHistoryService.HoursFor(VolunteerStatusHistoryService.ActiveDays(changes, null, null));
        return new CertificateFullPeriodDto(active.Min(p => p.StartsOn), end < today ? end : today, hours,
            VolunteerStatusHistoryService.WeeklyHours);
    }

    /// <summary>
    /// Projetos da pessoa (na equipe ou com horas lancadas), com o periodo sugerido (da entrada na equipe ou da primeira
    /// hora lancada ate o fim do projeto ou hoje), as horas e os textos: o objetivo do projeto e o papel mais o que ela
    /// lancou que fez.
    /// </summary>
    private async Task<List<CertificateProjectDto>> ProjectsAsync(Guid volunteerId)
    {
        var memberships = await _db.ProjectVolunteers.AsNoTracking()
            .Where(pv => pv.VolunteerId == volunteerId)
            .Select(pv => new { pv.ProjectId, pv.RoleInProject, pv.JoinedAt })
            .ToListAsync();
        var entries = await _db.ProjectHourEntries.AsNoTracking()
            .Where(h => h.VolunteerId == volunteerId)
            .OrderBy(h => h.Date)
            .Select(h => new { h.ProjectId, h.Date, h.Hours, h.Description })
            .ToListAsync();

        var ids = memberships.Select(m => m.ProjectId).Concat(entries.Select(e => e.ProjectId)).Distinct().ToList();
        var projects = await _db.Projects.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new
            {
                p.Id, p.Name, Program = p.Program!.Name, p.Status, p.StartDate, p.EndDateForecast, p.ClosedOn, p.Objective,
                p.Description
            })
            .ToListAsync();

        var today = Mapping.Today;
        return projects.Select(p =>
            {
                var membership = memberships.FirstOrDefault(m => m.ProjectId == p.Id);
                var mine = entries.Where(e => e.ProjectId == p.Id).ToList();

                var start = membership is null ? p.StartDate : Max(p.StartDate, TextHelpers.BrasiliaDay(membership.JoinedAt));
                if (mine.Count > 0 && mine[0].Date < start) start = mine[0].Date;
                if (start > today) start = today;

                var closed = p.Status is ProjectStatus.Concluido or ProjectStatus.Cancelado;
                var end = today;
                if (closed)
                {
                    var last = mine.Count > 0 ? mine[^1].Date : (DateOnly?)null;
                    // O dia em que foi encerrado; sem ele (encerrado antes de o campo existir), a previsao que ja passou.
                    var forecast = p.ClosedOn ?? (p.EndDateForecast is { } f && f <= today ? f : (DateOnly?)null);
                    end = last is null && forecast is null ? today : Max(last ?? DateOnly.MinValue, forecast ?? DateOnly.MinValue);
                }
                if (end < start) end = start;

                var did = mine.Select(e => e.Description?.Trim().TrimEnd('.'))
                    .Where(d => !string.IsNullOrWhiteSpace(d))
                    .DistinctBy(d => SearchText.Fold(d!))
                    .Select(d => LowerFirst(d!))
                    .ToList();
                var activities = string.Join(": ", new[]
                {
                    membership?.RoleInProject?.Trim(),
                    did.Count > 0 ? string.Join("; ", did) : null
                }.Where(part => !string.IsNullOrWhiteSpace(part)));
                if (activities.Length > 0) activities = char.ToUpperInvariant(activities[0]) + activities[1..];

                return new CertificateProjectDto(
                    p.Id,
                    p.Name,
                    p.Program,
                    p.Status,
                    start,
                    end,
                    mine.Sum(e => e.Hours),
                    Shorten(p.Objective ?? p.Description, CertificateLimits.Summary),
                    Shorten(activities.Length > 0 ? activities + "." : null, CertificateLimits.Activities));
            })
            .OrderByDescending(p => p.Start)
            .ToList();
    }

    private static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;

    /// <summary>"Projeto hidrossanitario" -> "projeto hidrossanitario" (siglas como "ART" ficam como estao).</summary>
    private static string LowerFirst(string value) =>
        value.Length > 1 && char.IsUpper(value[0]) && char.IsLower(value[1])
            ? char.ToLowerInvariant(value[0]) + value[1..]
            : value;

    /// <summary>Texto sugerido cortado numa palavra inteira, com reticencias, quando passa do limite.</summary>
    private static string? Shorten(string? value, int max)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        if (text.Length <= max) return text;
        var cut = text[..(max - 1)];
        var space = cut.LastIndexOf(' ');
        return (space > max / 2 ? cut[..space] : cut).TrimEnd(',', ';', ':', ' ') + "…";
    }

    private static string? Clean(string? value, int max)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        return text.Length > max ? text[..max] : text;
    }

    /// <summary>11 digitos viram 000.000.000-00; qualquer outra coisa vai como foi digitada.</summary>
    private static string? FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return digits.Length == 11
            ? $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}"
            : cpf.Trim();
    }

    private async Task<byte[]?> ImageAsync(string? storedName) =>
        string.IsNullOrWhiteSpace(storedName) || !ImageExtensions.Contains(Path.GetExtension(storedName))
            ? null
            : await _storage.TryReadAsync(storedName);
}
