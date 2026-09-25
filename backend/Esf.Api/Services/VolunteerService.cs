using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class VolunteerService
{
    private readonly EsfDbContext _db;

    public VolunteerService(EsfDbContext db) => _db = db;

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
                v.Projects.Select(pv => new VolunteerProjectDto(pv.ProjectId, pv.Project!.Name, pv.Project!.Status, pv.RoleInProject)).ToList(),
                v.CreatedAt))
            .ToListAsync();
    }

    public async Task<VolunteerDto> GetAsync(Guid id)
    {
        var volunteer = await _db.Volunteers
            .AsNoTracking()
            .Include(v => v.Projects).ThenInclude(pv => pv.Project)
            .FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntario");

        var projects = volunteer.Projects.Select(Mapping.ToProjectDto).ToList();
        return Mapping.ToDto(volunteer, projects);
    }

    public async Task<VolunteerDto> CreateAsync(SaveVolunteerRequest request)
    {
        var volunteer = new Volunteer();
        Apply(volunteer, request);
        volunteer.CreatedAt = DateTime.UtcNow;

        _db.Volunteers.Add(volunteer);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(volunteer, new List<VolunteerProjectDto>());
    }

    public async Task<VolunteerDto> UpdateAsync(Guid id, SaveVolunteerRequest request)
    {
        var volunteer = await _db.Volunteers
            .Include(v => v.Projects).ThenInclude(pv => pv.Project)
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
    }
}
