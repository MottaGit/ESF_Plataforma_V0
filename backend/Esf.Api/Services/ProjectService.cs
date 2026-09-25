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

    public ProjectService(EsfDbContext db) => _db = db;

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

        if (q.OnlyLate)
            query = query.Where(p => p.EndDateForecast != null
                                     && p.EndDateForecast < today
                                     && p.Status != ProjectStatus.Concluido
                                     && p.Status != ProjectStatus.Cancelado);

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
            "progress" => query.OrderByDescending(p => p.Progress).ThenBy(p => p.Name),
            "deadline" => query.OrderBy(p => p.EndDateForecast ?? DateOnly.MaxValue).ThenBy(p => p.Name),
            _ => query.OrderByDescending(p => p.UpdatedAt)
        };

        return await query
            .Select(p => new ProjectListItemDto(
                p.Id,
                p.Name,
                p.ProgramId,
                p.Program!.Name,
                p.Status,
                p.Progress,
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
                p.UpdatedAt))
            .ToListAsync();
    }

    public async Task<ProjectDetailDto> GetDetailAsync(Guid id)
    {
        var project = await LoadFullAsync(id) ?? throw AppException.NotFound("Projeto");
        return Mapping.ToDetailDto(project);
    }

    /// <summary>Carrega o projeto com todas as colecoes (usado no detalhe e no relatorio).</summary>
    public async Task<Project?> LoadFullAsync(Guid id)
    {
        return await _db.Projects
            .AsNoTracking()
            .Include(p => p.Program)
            .Include(p => p.OwnerVolunteer)
            .Include(p => p.Activities).ThenInclude(a => a.AssignedVolunteer)
            .Include(p => p.Volunteers).ThenInclude(pv => pv.Volunteer)
            .Include(p => p.Indicators)
            .Include(p => p.Files).ThenInclude(f => f.UploadedByUser)
            .Include(p => p.Updates).ThenInclude(u => u.AuthorUser)
            .Include(p => p.Updates).ThenInclude(u => u.Attachments)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<ProjectDetailDto> CreateAsync(SaveProjectRequest request)
    {
        Validate(request);
        await EnsureProgramExistsAsync(request.ProgramId);

        var project = new Project();
        Apply(project, request);
        project.CreatedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return await GetDetailAsync(project.Id);
    }

    public async Task<ProjectDetailDto> UpdateAsync(Guid id, SaveProjectRequest request)
    {
        Validate(request);
        await EnsureProgramExistsAsync(request.ProgramId);

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");
        Apply(project, request);
        project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetDetailAsync(id);
    }

    public async Task<ProjectDetailDto> UpdateStatusAsync(Guid id, ProjectStatus status)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        project.Status = status;
        if (status == ProjectStatus.Concluido) project.Progress = 100;
        project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetDetailAsync(id);
    }

    public async Task<ProjectDetailDto> UpdateProgressAsync(Guid id, int progress)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        project.Progress = Math.Clamp(progress, 0, 100);
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
            .FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Projeto");

        var storedNames = project.Files.Select(f => f.StoredName)
            .Concat(project.Updates.SelectMany(u => u.Attachments).Select(f => f.StoredName))
            .ToList();

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();

        return storedNames;
    }

    private static void Validate(SaveProjectRequest request)
    {
        if (request.EndDateForecast.HasValue && request.StartDate.HasValue
            && request.EndDateForecast.Value < request.StartDate.Value)
            throw new AppException("A previsao de termino nao pode ser anterior a data de inicio.");
    }

    private async Task EnsureProgramExistsAsync(Guid? programId)
    {
        if (!await _db.Programs.AnyAsync(p => p.Id == programId!.Value))
            throw new AppException("O programa informado nao existe.");
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
        project.Status = r.Status!.Value;
        project.Progress = Math.Clamp(r.Progress, 0, 100);

        if (project.Status == ProjectStatus.Concluido && project.Progress < 100)
            project.Progress = 100;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
