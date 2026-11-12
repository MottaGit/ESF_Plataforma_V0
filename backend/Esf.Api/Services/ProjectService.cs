using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ProjectService
{
    private readonly EsfDbContext _db;
    private readonly NotificationService _notifications;

    public ProjectService(EsfDbContext db, NotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    public async Task<List<ProjectListItemDto>> ListAsync(ProjectQuery q)
    {
        var today = Mapping.Today;
        var query = _db.Projects.AsNoTracking();

        if (!q.IncludeArchived)
            query = query.Where(p => !p.IsArchived);

        if (q.Status.HasValue)
            query = query.Where(p => p.Status == q.Status.Value);

        if (q.ProgramId.HasValue)
            query = query.Where(p => p.ProgramId == q.ProgramId.Value);

        if (q.OwnerVolunteerId.HasValue)
            query = query.Where(p => p.OwnerVolunteerId == q.OwnerVolunteerId.Value);

        if (q.MemberVolunteerId is { } member)
            query = query.Where(p => p.OwnerVolunteerId == member || p.Volunteers.Any(v => v.VolunteerId == member));

        if (q.OnlyLate)
            query = query.Where(p => p.EndDateForecast != null
                                     && p.EndDateForecast < today
                                     && p.Status != ProjectStatus.Concluido
                                     && p.Status != ProjectStatus.Cancelado);

        if (q.OnlyStale)
        {
            var staleIds = DashboardService.StaleProjectsQuery(_db, DateTime.UtcNow.AddDays(-DashboardService.StaleDays))
                .Select(p => p.Id);
            query = query.Where(p => staleIds.Contains(p.Id));
        }

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var pattern = $"%{q.Search.Trim()}%";
            query = query.Where(p =>
                EF.Functions.ILike(p.Name, pattern)
                || (p.Description != null && EF.Functions.ILike(p.Description, pattern))
                || (p.Beneficiaries != null && EF.Functions.ILike(p.Beneficiaries, pattern))
                || (p.District != null && EF.Functions.ILike(p.District, pattern))
                || (p.City != null && EF.Functions.ILike(p.City, pattern))
                || EF.Functions.ILike(p.Program!.Name, pattern));
        }

        query = q.Sort switch
        {
            "name" => query.OrderBy(p => p.Name),
            "status" => query.OrderBy(p => p.Status).ThenBy(p => p.Name),
            "progress" => query.OrderBy(p => p.Name),
            "deadline" => query.OrderBy(p => p.EndDateForecast ?? DateOnly.MaxValue).ThenBy(p => p.Name),
            _ => query.OrderByDescending(p => p.UpdatedAt)
        };

        var items = await query
            .Select(p => new ProjectListItemDto(
                p.Id,
                p.Name,
                p.ProgramId,
                p.Program!.Name,
                p.Status,
                p.OwnerVolunteerId,
                p.OwnerVolunteer != null ? p.OwnerVolunteer.Name : null,
                p.District,
                p.City,
                p.StartDate,
                p.EndDateForecast,
                p.EndDateForecast != null
                    && p.EndDateForecast < today
                    && p.Status != ProjectStatus.Concluido
                    && p.Status != ProjectStatus.Cancelado,
                p.IsArchived,
                p.Activities.Count,
                p.Activities.Count(a => a.Status == ActivityStatus.Concluida),
                p.Volunteers.Count,
                p.UpdatedAt,
                p.Updates.Max(u => (DateTime?)u.CreatedAt),
                _db.SignedDocuments
                    .Where(d => d.ProjectId == p.Id && d.Kind == SignedDocumentKind.BeneficiaryImageAuthorization)
                    .Max(d => (DateOnly?)d.SignedOn),
                p.Program!.Icon,
                p.Program!.Color,
                p.Latitude,
                p.Longitude))
            .ToListAsync();

        // O progresso e calculado em memoria, entao a ordenacao por ele tambem (a lista ja vem por nome).
        return q.Sort == "progress"
            ? items.OrderByDescending(p => p.Progress).ToList()
            : items;
    }

    public async Task<ProjectDetailDto> GetDetailAsync(Guid id)
    {
        var project = await LoadFullAsync(id) ?? throw AppException.NotFound("Projeto");
        var imageAuthorizedOn = await _db.SignedDocuments
            .Where(d => d.ProjectId == id && d.Kind == SignedDocumentKind.BeneficiaryImageAuthorization)
            .MaxAsync(d => (DateOnly?)d.SignedOn);
        var counts = await ActivityCounts.ForAsync(_db, project.Activities.Select(a => a.Id).ToList());
        var updatesCount = await _db.ProjectUpdates.CountAsync(u => u.ProjectId == id);
        var filesCount = await _db.ProjectFiles.CountAsync(f => f.ProjectId == id);
        return Mapping.ToDetailDto(project, updatesCount, filesCount, imageAuthorizedOn, counts);
    }

    /// <summary>
    /// O projeto com tarefas, equipe e indicadores (o que a tela usa em todas as abas). Registros e arquivos, que so
    /// crescem, ficam nas rotas proprias das abas Andamento e Arquivos.
    /// </summary>
    /// <remarks>
    /// Uma consulta por colecao (AsSplitQuery): numa so, o banco devolveria uma linha para cada combinacao de tarefa,
    /// pessoa e indicador.
    /// </remarks>
    public async Task<Project?> LoadFullAsync(Guid id)
    {
        return await _db.Projects
            .AsNoTracking()
            .AsSplitQuery()
            .Include(p => p.Program)
            .Include(p => p.OwnerVolunteer)
            .Include(p => p.Activities).ThenInclude(a => a.AssignedVolunteer)
            .Include(p => p.Activities).ThenInclude(a => a.CompanionVolunteer)
            .Include(p => p.Volunteers).ThenInclude(pv => pv.Volunteer)
            .Include(p => p.Indicators)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<ProjectDetailDto> CreateAsync(SaveProjectRequest request)
    {
        Validate(request);
        await EnsureProgramExistsAsync(request.ProgramId);
        await EnsureOwnerExistsAsync(request.OwnerVolunteerId);

        var project = new Project();
        Apply(project, request);
        project.CreatedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;

        // Ficha do programa: descricao e objetivo em branco comecam com os do programa (sempre, com ou sem o modelo).
        var program = await _db.Programs.AsNoTracking()
            .Where(p => p.Id == project.ProgramId)
            .Select(p => new { p.Description, p.Objective })
            .FirstAsync();
        project.Description ??= program.Description;
        project.Objective ??= program.Objective;

        _db.Projects.Add(project);
        var nationals = await NationalIndicatorService.AddActiveToNewProjectAsync(_db, project);
        if (request.UseTemplate) await ApplyProgramTemplateAsync(project, nationals);
        await ProjectTeam.EnsureMemberAsync(_db, project.Id, project.OwnerVolunteerId);
        if (project.OwnerVolunteerId.HasValue)
            await _notifications.ProjectOwnerAsync(project.OwnerVolunteerId.Value, project.Id, project.Name);
        await _db.SaveChangesAsync();

        return await GetDetailAsync(project.Id);
    }

    public async Task<ProjectDetailDto> UpdateAsync(Guid id, SaveProjectRequest request)
    {
        Validate(request);
        await EnsureProgramExistsAsync(request.ProgramId);
        await EnsureOwnerExistsAsync(request.OwnerVolunteerId);

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");
        var previousOwner = project.OwnerVolunteerId;
        Apply(project, request);
        project.UpdatedAt = DateTime.UtcNow;

        await ProjectTeam.EnsureMemberAsync(_db, project.Id, project.OwnerVolunteerId);
        if (project.OwnerVolunteerId.HasValue && project.OwnerVolunteerId != previousOwner)
            await _notifications.ProjectOwnerAsync(project.OwnerVolunteerId.Value, project.Id, project.Name);
        await _db.SaveChangesAsync();
        return await GetDetailAsync(id);
    }

    /// <summary>
    /// Muda o status. Concluir ou cancelar grava o dia em que isso aconteceu (o informado ou hoje); voltar a um status
    /// aberto apaga esse dia. Escolher de novo o mesmo status encerrado, sem dia, mantem o que ja havia.
    /// </summary>
    public async Task<ProjectDetailDto> UpdateStatusAsync(Guid id, ProjectStatus status, DateOnly? closedOn = null)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        var changed = project.Status != status;
        project.Status = status;
        if (!IsClosed(status))
            project.ClosedOn = null;
        else if (closedOn.HasValue)
            project.ClosedOn = ValidClosedOn(project, closedOn.Value);
        else if (changed || project.ClosedOn is null)
            project.ClosedOn = Mapping.Today;
        project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetDetailAsync(id);
    }

    public async Task<ProjectDetailDto> SetArchivedAsync(Guid id, bool archived)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        project.IsArchived = archived;
        project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetDetailAsync(id);
    }

    /// <summary>Exclusao definitiva. Atividades, indicadores, vinculos e registros de arquivos vao em cascata.</summary>
    public async Task<List<string>> DeleteAsync(Guid id)
    {
        var project = await _db.Projects
            .Include(p => p.Files)
            .Include(p => p.Updates).ThenInclude(u => u.Attachments)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        var storedNames = project.Files.Select(f => f.StoredName)
            .Concat(project.Updates.SelectMany(u => u.Attachments).Select(f => f.StoredName))
            .Concat(await SignedDocumentService.StoredNamesAsync(_db, null, id))
            .ToList();

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();

        return storedNames;
    }

    /// <summary>
    /// Modelo do programa num projeto novo: cria as atividades (sem responsavel; prazo contado do inicio) e os
    /// indicadores (em branco; os nacionais que o projeto ja recebeu nao se repetem).
    /// </summary>
    private async Task ApplyProgramTemplateAsync(Project project, HashSet<Guid> nationalsAlreadyIn)
    {
        var program = await _db.Programs.AsNoTracking()
            .Include(p => p.TemplateActivities)
            .Include(p => p.TemplateIndicators)
            .AsSplitQuery()
            .FirstAsync(p => p.Id == project.ProgramId);

        var now = DateTime.UtcNow;
        foreach (var item in program.TemplateActivities.OrderBy(a => a.Position))
        {
            _db.Activities.Add(new Activity
            {
                ProjectId = project.Id,
                Title = item.Title,
                Description = item.Description,
                Priority = item.Priority,
                Status = ActivityStatus.AFazer,
                DueDate = item.DueDays.HasValue ? project.StartDate.AddDays(item.DueDays.Value) : null,
                CreatedAt = now
            });
        }

        foreach (var item in program.TemplateIndicators.OrderBy(x => x.Position))
        {
            if (item.NationalIndicatorId is { } nationalId && nationalsAlreadyIn.Contains(nationalId)) continue;
            _db.Indicators.Add(new Indicator
            {
                ProjectId = project.Id,
                NationalIndicatorId = item.NationalIndicatorId,
                Name = item.Name,
                Unit = item.Unit,
                Value = null,
                // Mesma ordem do modelo (a lista de indicadores segue a data de criacao).
                CreatedAt = now.AddTicks(item.Position)
            });
        }
    }

    private static bool IsClosed(ProjectStatus status) => status is ProjectStatus.Concluido or ProjectStatus.Cancelado;

    /// <summary>O dia do encerramento nao pode ser depois de hoje, e a conclusao nao pode ser antes do inicio.</summary>
    private static DateOnly ValidClosedOn(Project project, DateOnly day)
    {
        var concluded = project.Status == ProjectStatus.Concluido;
        if (day > Mapping.Today)
            throw new AppException(concluded
                ? "A data de conclusão não pode ser depois de hoje."
                : "A data do cancelamento não pode ser depois de hoje.");
        if (concluded && day < project.StartDate)
            throw new AppException("A data de conclusão não pode ser antes da data de início.");
        return day;
    }

    private static void Validate(SaveProjectRequest request)
    {
        if (request.EndDateForecast.HasValue && request.StartDate.HasValue
            && request.EndDateForecast.Value < request.StartDate.Value)
            throw new AppException("A previsão de término não pode ser anterior à data de início.");
    }

    private async Task EnsureProgramExistsAsync(Guid? programId)
    {
        if (!await _db.Programs.AnyAsync(p => p.Id == programId!.Value))
            throw new AppException("O programa informado não existe.");
    }

    private async Task EnsureOwnerExistsAsync(Guid? volunteerId)
    {
        if (volunteerId.HasValue && !await _db.Volunteers.AnyAsync(v => v.Id == volunteerId.Value))
            throw new AppException("O responsável informado não existe.");
    }

    private static void Apply(Project project, SaveProjectRequest r)
    {
        project.Name = r.Name.Trim();
        project.Description = Clean(r.Description);
        project.ProgramId = r.ProgramId!.Value;
        project.OwnerVolunteerId = r.OwnerVolunteerId;
        project.Objective = Clean(r.Objective);
        project.Beneficiaries = Clean(r.Beneficiaries);
        project.TargetAudience = Clean(r.TargetAudience);
        project.Notes = Clean(r.Notes);
        project.Address = Clean(r.Address);
        project.District = Clean(r.District);
        project.City = Clean(r.City);
        project.State = Clean(r.State);
        project.Latitude = r.Latitude;
        project.Longitude = r.Longitude;
        project.StartDate = r.StartDate!.Value;
        project.EndDateForecast = r.EndDateForecast;
        // Em Editar projeto, o dia do encerramento pode ser corrigido (ou ficar vazio nos encerrados antes de o campo
        // existir); mudar para encerrado por aqui grava hoje quando nao vem o dia.
        var changed = project.Status != r.Status!.Value;
        project.Status = r.Status!.Value;
        if (!IsClosed(project.Status))
            project.ClosedOn = null;
        else if (r.ClosedOn.HasValue)
            project.ClosedOn = ValidClosedOn(project, r.ClosedOn.Value);
        else
            project.ClosedOn = changed ? Mapping.Today : null;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
