using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class VolunteerService
{
    private static readonly HashSet<string> PhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public VolunteerService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<List<VolunteerDto>> ListAsync(string? search, bool onlyActive, VolunteerSector? sector)
    {
        var query = _db.Volunteers.AsNoTracking();

        if (onlyActive)
            query = query.Where(v => v.Status == VolunteerStatus.Ativo);

        if (sector.HasValue)
            query = query.Where(v => v.Sector == sector.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(v =>
                EF.Functions.ILike(v.Name, pattern)
                || (v.Email != null && EF.Functions.ILike(v.Email, pattern)));
        }

        return await query
            .OrderBy(v => v.Name)
            .Select(v => new VolunteerDto(
                v.Id,
                v.Name,
                v.Email,
                v.Phone,
                v.Sector,
                v.Skills,
                v.Notes,
                v.Status,
                v.Projects.Select(pv => new VolunteerProjectDto(
                    pv.ProjectId,
                    pv.Project!.Name,
                    pv.Project!.Status,
                    pv.Project!.Program!.Name,
                    pv.RoleInProject)).ToList(),
                v.CreatedAt,
                v.BirthDay,
                v.BirthMonth,
                v.PhotoStoredName != null ? Mapping.UploadsUrlPrefix + "/" + v.PhotoStoredName : null))
            .ToListAsync();
    }

    public async Task<VolunteerDto> GetAsync(Guid id)
    {
        var volunteer = await _db.Volunteers
            .AsNoTracking()
            .Include(v => v.Projects).ThenInclude(pv => pv.Project).ThenInclude(p => p!.Program)
            .FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        var projects = volunteer.Projects.Select(Mapping.ToProjectDto).ToList();
        return Mapping.ToDto(volunteer, projects);
    }

    public async Task<VolunteerDto> CreateAsync(SaveVolunteerRequest request)
    {
        ValidateBirthday(request);
        var volunteer = new Volunteer();
        Apply(volunteer, request);
        volunteer.CreatedAt = DateTime.UtcNow;

        _db.Volunteers.Add(volunteer);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(volunteer, new List<VolunteerProjectDto>());
    }

    public async Task<VolunteerDto> UpdateAsync(Guid id, SaveVolunteerRequest request)
    {
        ValidateBirthday(request);
        var volunteer = await _db.Volunteers
            .Include(v => v.Projects).ThenInclude(pv => pv.Project).ThenInclude(p => p!.Program)
            .FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        Apply(volunteer, request);
        await _db.SaveChangesAsync();

        var projects = volunteer.Projects.Select(Mapping.ToProjectDto).ToList();
        return Mapping.ToDto(volunteer, projects);
    }

    public async Task DeleteAsync(Guid id)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        _db.Volunteers.Remove(volunteer);
        await _db.SaveChangesAsync();

        if (volunteer.PhotoStoredName is not null) _storage.Delete(volunteer.PhotoStoredName);
    }

    /// <summary>Troca a foto do voluntario (a imagem ja chega recortada pelo navegador).</summary>
    public async Task<VolunteerDto> SetPhotoAsync(Guid id, IFormFile file)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        if (file is null || !PhotoExtensions.Contains(Path.GetExtension(file.FileName))
            || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new AppException("Envie uma imagem JPG, PNG ou WEBP.");

        var saved = await _storage.SaveAsync(file);
        var previous = volunteer.PhotoStoredName;

        volunteer.PhotoStoredName = saved.StoredName;
        await _db.SaveChangesAsync();

        if (previous is not null) _storage.Delete(previous);
        return await GetAsync(id);
    }

    public async Task<VolunteerDto> RemovePhotoAsync(Guid id)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        var previous = volunteer.PhotoStoredName;
        volunteer.PhotoStoredName = null;
        await _db.SaveChangesAsync();

        if (previous is not null) _storage.Delete(previous);
        return await GetAsync(id);
    }

    public async Task<List<ProjectVolunteerDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var links = await _db.ProjectVolunteers
            .AsNoTracking()
            .Include(pv => pv.Volunteer)
            .Where(pv => pv.ProjectId == projectId)
            .OrderBy(pv => pv.Volunteer!.Name)
            .ToListAsync();

        return links.Select(Mapping.ToDto).ToList();
    }

    public async Task<ProjectVolunteerDto> AddToProjectAsync(Guid projectId, AddProjectVolunteerRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var volunteerId = request.VolunteerId!.Value;
        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId))
            throw AppException.NotFound("Voluntario");

        if (await _db.ProjectVolunteers.AnyAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId))
            throw AppException.Conflict("Este voluntario ja participa do projeto.");

        var link = new ProjectVolunteer
        {
            ProjectId = projectId,
            VolunteerId = volunteerId,
            RoleInProject = string.IsNullOrWhiteSpace(request.RoleInProject) ? null : request.RoleInProject.Trim(),
            JoinedAt = DateTime.UtcNow
        };

        _db.ProjectVolunteers.Add(link);
        await _db.SaveChangesAsync();

        await _db.Entry(link).Reference(l => l.Volunteer).LoadAsync();
        return Mapping.ToDto(link);
    }

    public async Task RemoveFromProjectAsync(Guid projectId, Guid volunteerId)
    {
        var link = await _db.ProjectVolunteers
            .FirstOrDefaultAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId)
            ?? throw AppException.NotFound("Vinculo do voluntario");

        if (await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerVolunteerId == volunteerId))
            throw new AppException("Este voluntario e o responsavel pelo projeto. Troque o responsavel antes de desvincula-lo.");

        _db.ProjectVolunteers.Remove(link);
        await _db.SaveChangesAsync();
    }

    private static void Apply(Volunteer volunteer, SaveVolunteerRequest r)
    {
        volunteer.Name = r.Name.Trim();
        volunteer.Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
        volunteer.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone.Trim();
        volunteer.Sector = r.Sector!.Value;
        volunteer.Skills = string.IsNullOrWhiteSpace(r.Skills) ? null : r.Skills.Trim();
        volunteer.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        volunteer.Status = r.Status!.Value;
        volunteer.BirthDay = r.BirthDay;
        volunteer.BirthMonth = r.BirthMonth;
    }

    /// <summary>Aniversario: dia e mes juntos (ou nenhum), formando uma data que existe (29/02 vale).</summary>
    private static void ValidateBirthday(SaveVolunteerRequest r)
    {
        if (r.BirthDay.HasValue != r.BirthMonth.HasValue)
            throw new AppException("Informe o dia e o mes do aniversario.");

        if (r.BirthDay.HasValue && r.BirthDay.Value > DateTime.DaysInMonth(2000, r.BirthMonth!.Value))
            throw new AppException("Esse dia nao existe no mes escolhido.");
    }
}
