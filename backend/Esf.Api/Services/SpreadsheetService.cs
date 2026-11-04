using System.Text.RegularExpressions;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Spreadsheets;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Planilha de programas, projetos e voluntarios do nucleo: exportacao (com a escolha do que entra) e o modelo vazio
/// de importacao. A leitura da planilha preenchida fica em SpreadsheetImportService.
/// </summary>
public partial class SpreadsheetService
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;

    public SpreadsheetService(EsfDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<(byte[] Content, string FileName)> ExportAsync(ExportSpreadsheetRequest request)
    {
        if (!request.Projects && !request.Volunteers)
            throw new AppException("Escolha o que exportar: projetos, voluntários ou os dois.");

        var nucleo = await NucleoNameAsync();
        var nationals = await NationalColumnsAsync(_db);
        var programs = await ProgramsAsync(_db);
        var projects = request.Projects ? await ProjectRowsAsync(programs) : new List<ProjectSheetRow>();
        var volunteers = request.Volunteers ? await VolunteerRowsAsync() : new List<VolunteerSheetRow>();
        // Pares Indicador/Valor: tres, ou mais se algum programa exportado tiver mais indicadores especificos.
        var exported = projects.Select(p => p.Program).ToHashSet();
        var slots = programs.Where(p => exported.Contains(p.Name)).Select(p => p.Indicators.Count)
            .Append(SpreadsheetLayout.SpecificSlots).Max();

        var who = await CurrentUserLabelAsync();
        var content = SpreadsheetBuilder.Build(new SpreadsheetContent
        {
            Export = true,
            IncludeProjects = request.Projects,
            IncludeVolunteers = request.Volunteers,
            Nucleo = nucleo,
            GeneratedAt = DateTime.UtcNow.ToLocalTime(),
            GeneratedBy = who,
            Nationals = nationals,
            Slots = slots,
            Programs = programs,
            Projects = projects,
            Volunteers = volunteers,
            VolunteerNames = await VolunteerNamesAsync(_db),
            SpecificIndicators = SpecificLabels(programs)
        });

        // A exportacao leva dados pessoais: fica no historico de alteracoes (quem exportou o que e quando).
        var what = request.Projects && request.Volunteers ? "Projetos e voluntários" : request.Projects ? "Projetos" : "Voluntários";
        _db.AuditEntries.Add(new AuditEntry
        {
            OrganizationId = _db.CurrentOrganizationId,
            At = DateTime.UtcNow,
            UserId = _currentUser.Id,
            UserName = await CurrentUserNameAsync(),
            Action = AuditAction.Exported,
            EntityType = "Planilha",
            EntityLabel = what
        });
        await _db.SaveChangesAsync();

        return (content, $"{Slug(nucleo)}-exportacao-{Mapping.Today:yyyy-MM-dd}.xlsx");
    }

    /// <summary>Modelo vazio de importacao, com as listas (programas, pessoas, indicadores) do nucleo.</summary>
    public async Task<(byte[] Content, string FileName)> TemplateAsync()
    {
        var nucleo = await NucleoNameAsync();
        var programs = await ProgramsAsync(_db);
        var content = SpreadsheetBuilder.Build(new SpreadsheetContent
        {
            Export = false,
            IncludeProjects = true,
            IncludeVolunteers = true,
            Nucleo = nucleo,
            GeneratedAt = DateTime.UtcNow.ToLocalTime(),
            Nationals = await NationalColumnsAsync(_db),
            Programs = programs,
            VolunteerNames = await VolunteerNamesAsync(_db),
            SpecificIndicators = SpecificLabels(programs)
        });
        return (content, $"{Slug(nucleo)}-modelo-importacao.xlsx");
    }

    // ---------- dados comuns (tambem usados na importacao) ----------

    private async Task<string> NucleoNameAsync() =>
        await _db.Organizations.AsNoTracking().Select(o => o.Name).FirstOrDefaultAsync() ?? "Núcleo";

    /// <summary>Nacionais ativos, na ordem da lista de indicadores (por nome): uma coluna fixa cada.</summary>
    public static Task<List<NationalColumn>> NationalColumnsAsync(EsfDbContext db) =>
        db.NationalIndicators.AsNoTracking()
            .Where(n => !n.IsArchived)
            .OrderBy(n => n.Name)
            .Select(n => new NationalColumn(n.Id, n.Name, n.Unit, n.Description))
            .ToListAsync();

    public static async Task<List<string>> VolunteerNamesAsync(EsfDbContext db) =>
        (await db.Volunteers.AsNoTracking().Where(v => v.AnonymizedAt == null).Select(v => v.Name).ToListAsync())
        .OrderBy(SearchText.Fold, StringComparer.Ordinal).ToList();

    /// <summary>
    /// Programas do nucleo (ativos primeiro, depois por nome) com os indicadores especificos na ordem: os do modelo do
    /// programa e depois os que os projetos dele usam, sem repetir.
    /// </summary>
    public static async Task<List<ProgramSheetRow>> ProgramsAsync(EsfDbContext db)
    {
        var programs = await db.Programs.AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Status,
                Template = p.TemplateIndicators.Where(i => i.NationalIndicatorId == null)
                    .OrderBy(i => i.Position).Select(i => new { i.Name, i.Unit }).ToList(),
                Projects = p.Projects.Count,
                Open = p.Projects.Count(x => x.Status == ProjectStatus.Planejamento || x.Status == ProjectStatus.EmAndamento
                                             || x.Status == ProjectStatus.Pausado)
            })
            .ToListAsync();
        var used = await db.Indicators.AsNoTracking()
            .Where(i => i.NationalIndicatorId == null)
            .OrderBy(i => i.CreatedAt)
            .Select(i => new { i.Project!.ProgramId, i.Name, i.Unit })
            .ToListAsync();

        return programs
            .Select(p => new ProgramSheetRow(
                p.Name,
                p.Status == ProgramStatus.Arquivado,
                p.Projects,
                p.Open,
                p.Template.Select(i => SpreadsheetLayout.IndicatorLabel(i.Name, i.Unit))
                    .Concat(used.Where(i => i.ProgramId == p.Id).Select(i => SpreadsheetLayout.IndicatorLabel(i.Name, i.Unit)))
                    .DistinctBy(SearchText.Fold)
                    .ToList()))
            .OrderBy(p => p.Archived)
            .ThenBy(p => SearchText.Fold(p.Name), StringComparer.Ordinal)
            .ToList();
    }

    private static List<string> SpecificLabels(IEnumerable<ProgramSheetRow> programs) =>
        programs.SelectMany(p => p.Indicators).DistinctBy(SearchText.Fold)
            .OrderBy(SearchText.Fold, StringComparer.Ordinal).ToList();

    // ---------- linhas da exportacao ----------

    private async Task<List<ProjectSheetRow>> ProjectRowsAsync(List<ProgramSheetRow> programs)
    {
        var projects = await _db.Projects.AsNoTracking()
            .Include(p => p.Program)
            .Include(p => p.OwnerVolunteer)
            .Include(p => p.Indicators)
            .Include(p => p.Volunteers).ThenInclude(pv => pv.Volunteer)
            .AsSplitQuery()
            .ToListAsync();
        var imageAuthorizations = await _db.SignedDocuments.AsNoTracking()
            .Where(d => d.Kind == SignedDocumentKind.BeneficiaryImageAuthorization && d.ProjectId != null)
            .GroupBy(d => d.ProjectId!.Value)
            .Select(g => new { ProjectId = g.Key, SignedOn = g.Max(d => d.SignedOn) })
            .ToDictionaryAsync(x => x.ProjectId, x => x.SignedOn);

        var order = programs.Select((p, i) => (p.Name, i)).ToDictionary(x => x.Name, x => x.i);
        var indicatorsOf = programs.ToDictionary(p => p.Name, p => p.Indicators);

        return projects
            .OrderBy(p => order.GetValueOrDefault(p.Program!.Name))
            .ThenBy(p => p.StartDate)
            .ThenBy(p => SearchText.Fold(p.Name), StringComparer.Ordinal)
            .Select(p =>
            {
                var program = p.Program!.Name;
                var specific = p.Indicators.Where(i => i.NationalIndicatorId == null)
                    .ToDictionary(i => SearchText.Fold(SpreadsheetLayout.IndicatorLabel(i.Name, i.Unit)), i => i.Value);
                // Mesmos indicadores e mesma ordem em todos os projetos do programa (em branco quando o projeto nao tem).
                var pairs = indicatorsOf.GetValueOrDefault(program, new List<string>())
                    .Select(label => (label, specific.GetValueOrDefault(SearchText.Fold(label))))
                    .ToList();
                var team = p.Volunteers
                    .OrderBy(v => v.VolunteerId != p.OwnerVolunteerId)
                    .ThenBy(v => v.JoinedAt)
                    .Select(v => string.IsNullOrWhiteSpace(v.RoleInProject) ? v.Volunteer!.Name : $"{v.Volunteer!.Name} ({v.RoleInProject})");

                return new ProjectSheetRow(
                    program,
                    // Programa de um projeto so: o nome do projeto fica em branco (e o do programa).
                    SearchText.Fold(p.Name) == SearchText.Fold(program) ? null : p.Name,
                    p.Status,
                    p.StartDate,
                    p.EndDateForecast,
                    p.OwnerVolunteer?.Name,
                    p.Indicators.Where(i => i.NationalIndicatorId != null)
                        .GroupBy(i => i.NationalIndicatorId!.Value)
                        .ToDictionary(g => g.Key, g => g.First().Value),
                    pairs,
                    p.Volunteers.Count > 0 ? string.Join("; ", team) : null,
                    p.Objective,
                    p.Description,
                    p.Beneficiaries,
                    p.TargetAudience,
                    p.Address,
                    p.District,
                    p.City,
                    p.State,
                    p.Notes,
                    imageAuthorizations.TryGetValue(p.Id, out var signedOn) ? signedOn : null);
            })
            .ToList();
    }

    private async Task<List<VolunteerSheetRow>> VolunteerRowsAsync()
    {
        var volunteers = await _db.Volunteers.AsNoTracking().Where(v => v.AnonymizedAt == null).ToListAsync();
        var ids = volunteers.Select(v => v.Id).ToList();
        var history = (await _db.VolunteerStatusChanges.AsNoTracking()
                .Where(c => ids.Contains(c.VolunteerId))
                .ToListAsync())
            .GroupBy(c => c.VolunteerId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<VolunteerStatusChange>)g.OrderBy(c => c.StartsOn).ToList());
        var terms = await _db.SignedDocuments.AsNoTracking()
            .Where(d => d.Kind == SignedDocumentKind.VolunteerTerm && d.VolunteerId != null)
            .GroupBy(d => d.VolunteerId!.Value)
            .Select(g => new { VolunteerId = g.Key, SignedOn = g.Max(d => d.SignedOn) })
            .ToDictionaryAsync(x => x.VolunteerId, x => x.SignedOn);
        var access = await _db.Users.AsNoTracking()
            .Where(u => u.VolunteerId != null)
            .Select(u => new { VolunteerId = u.VolunteerId!.Value, u.Role, u.IsActive })
            .ToListAsync();

        return volunteers
            .OrderBy(v => SearchText.Fold(v.Name), StringComparer.Ordinal)
            .Select(v =>
            {
                var changes = history.GetValueOrDefault(v.Id) ?? Array.Empty<VolunteerStatusChange>();
                var started = changes.Where(c => c.Status.HasValue).ToList();
                // Saiu em: o dia antes de virar Ex-membro (so quando ha um periodo antes disso).
                DateOnly? left = v.Status == VolunteerStatus.ExMembro && started.Count > 1 && started[^1].Status == VolunteerStatus.ExMembro
                    ? started[^1].StartsOn.AddDays(-1)
                    : null;
                var login = access.FirstOrDefault(a => a.VolunteerId == v.Id);
                return new VolunteerSheetRow(
                    v.Name,
                    v.Email,
                    v.Phone,
                    v.Sector,
                    v.Status,
                    started.Count > 0 ? started[0].StartsOn : null,
                    left,
                    v.BirthDay,
                    v.BirthMonth,
                    v.Skills,
                    v.Notes,
                    terms.TryGetValue(v.Id, out var signedOn) ? signedOn : null,
                    VolunteerStatusHistoryService.HoursFor(VolunteerStatusHistoryService.ActiveDays(changes, null, null)),
                    login is null ? "Sem acesso" : RoleLabel(login.Role) + (login.IsActive ? "" : " (desativado)"));
            })
            .ToList();
    }

    private static string RoleLabel(UserRole role) => role switch
    {
        UserRole.Administrador => "Administrador",
        UserRole.Coordenador => "Coordenador",
        _ => "Usuário"
    };

    /// <summary>Nome de quem esta logado como o historico mostra (o do voluntario, se houver).</summary>
    private async Task<string> CurrentUserNameAsync()
    {
        var id = _currentUser.Id;
        var name = await _db.Users.AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => u.Volunteer != null ? u.Volunteer.Name : u.Name)
            .FirstOrDefaultAsync();
        return name ?? _currentUser.Name ?? "Alguém";
    }

    private async Task<string> CurrentUserLabelAsync()
    {
        var name = await CurrentUserNameAsync();
        return _currentUser.Role is { } role ? $"{name} ({RoleLabel(role)})" : name;
    }

    /// <summary>Nome do nucleo para o arquivo: "ESF Porto Alegre" vira "esf-porto-alegre".</summary>
    private static string Slug(string name)
    {
        var slug = NotAlphanumeric().Replace(SearchText.Fold(name), "-").Trim('-');
        return slug.Length > 0 ? slug : "esf";
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NotAlphanumeric();
}
