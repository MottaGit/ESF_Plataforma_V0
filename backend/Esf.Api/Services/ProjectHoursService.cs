using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Horas de voluntariado por projeto. Qualquer pessoa da equipe lanca as proprias; administrador e coordenador lancam,
/// corrigem e apagam as de qualquer um da equipe. As horas valem para o relatorio do projeto e o certificado por
/// projeto.
/// </summary>
public class ProjectHoursService
{
    public const decimal MaxHoursPerDay = 24;

    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ProjectHoursService(EsfDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    private bool CanManage => _currentUser.Role is UserRole.Administrador or UserRole.Coordenador;

    public async Task<ProjectHoursDto> ListAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId)) throw AppException.NotFound("Projeto");
        var mine = await MyVolunteerIdAsync(_db, _currentUser);

        var entries = await _db.ProjectHourEntries
            .AsNoTracking()
            .Where(h => h.ProjectId == projectId)
            .OrderByDescending(h => h.Date)
            .ThenByDescending(h => h.CreatedAt)
            .Select(h => new
            {
                h.Id,
                h.VolunteerId,
                h.Volunteer!.Name,
                h.Volunteer.PhotoStoredName,
                h.Date,
                h.Hours,
                h.Description
            })
            .ToListAsync();

        var people = entries
            .GroupBy(h => new { h.VolunteerId, h.Name })
            .Select(g => new PersonHoursDto(g.Key.VolunteerId, g.Key.Name, g.Sum(h => h.Hours)))
            .OrderByDescending(p => p.Hours)
            .ThenBy(p => p.Name)
            .ToList();

        return new ProjectHoursDto(
            entries.Sum(h => h.Hours),
            people,
            entries.Select(h => new ProjectHourEntryDto(
                h.Id,
                h.VolunteerId,
                h.Name,
                Mapping.PhotoUrl(h.PhotoStoredName),
                h.Date,
                h.Hours,
                h.Description,
                CanManage || h.VolunteerId == mine)).ToList());
    }

    public async Task<ProjectHourEntryDto> CreateAsync(Guid projectId, SaveHourEntryRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId)) throw AppException.NotFound("Projeto");
        var entry = await NewEntryAsync(_db, _currentUser, projectId, request.VolunteerId, request.Date!.Value,
            request.Hours!.Value, request.Description);
        _db.ProjectHourEntries.Add(entry);
        await _db.SaveChangesAsync();
        return await GetAsync(entry.Id);
    }

    public async Task<ProjectHourEntryDto> UpdateAsync(Guid id, SaveHourEntryRequest request)
    {
        var entry = await _db.ProjectHourEntries.FirstOrDefaultAsync(h => h.Id == id) ?? throw AppException.NotFound("Lancamento de horas");
        await EnsureCanEditAsync(entry);

        var volunteerId = request.VolunteerId ?? entry.VolunteerId;
        if (volunteerId != entry.VolunteerId)
        {
            if (!CanManage) throw new AppException("Só a coordenação passa horas para outra pessoa.", 403);
            await EnsureTeamMemberAsync(_db, entry.ProjectId, volunteerId);
        }

        entry.VolunteerId = volunteerId;
        entry.Date = ValidDate(request.Date!.Value);
        entry.Hours = ValidHours(request.Hours!.Value);
        entry.Description = Clean(request.Description);
        await _db.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var entry = await _db.ProjectHourEntries.FirstOrDefaultAsync(h => h.Id == id) ?? throw AppException.NotFound("Lancamento de horas");
        await EnsureCanEditAsync(entry);
        _db.ProjectHourEntries.Remove(entry);
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Lancamento validado (nao chama SaveChanges): tambem usado ao registrar o andamento com as horas do dia. Sem
    /// <paramref name="volunteerId"/>, as horas sao de quem esta logado.
    /// </summary>
    public static async Task<ProjectHourEntry> NewEntryAsync(EsfDbContext db, ICurrentUser currentUser, Guid projectId,
        Guid? volunteerId, DateOnly date, decimal hours, string? description)
    {
        var mine = await MyVolunteerIdAsync(db, currentUser);
        var target = volunteerId ?? mine
                     ?? throw new AppException("Seu acesso não está ligado a um voluntário: peça a um administrador para vincular.");
        var canManage = currentUser.Role is UserRole.Administrador or UserRole.Coordenador;
        if (target != mine && !canManage) throw new AppException("Só a coordenação lança horas de outra pessoa.", 403);
        await EnsureTeamMemberAsync(db, projectId, target);

        return new ProjectHourEntry
        {
            ProjectId = projectId,
            VolunteerId = target,
            Date = ValidDate(date),
            Hours = ValidHours(hours),
            Description = Clean(description),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = currentUser.Id
        };
    }

    /// <summary>Horas de cada pessoa em cada projeto (para o relatorio), dentro do periodo quando houver.</summary>
    public static async Task<Dictionary<Guid, Dictionary<Guid, decimal>>> TotalsAsync(EsfDbContext db,
        IReadOnlyCollection<Guid> projectIds, DateOnly? from, DateOnly? to)
    {
        var rows = await db.ProjectHourEntries
            .AsNoTracking()
            .Where(h => projectIds.Contains(h.ProjectId)
                        && (from == null || h.Date >= from)
                        && (to == null || h.Date <= to))
            .GroupBy(h => new { h.ProjectId, h.VolunteerId })
            .Select(g => new { g.Key.ProjectId, g.Key.VolunteerId, Hours = g.Sum(h => h.Hours) })
            .ToListAsync();

        return rows
            .GroupBy(r => r.ProjectId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(r => r.VolunteerId, r => r.Hours));
    }

    // ---------- internos ----------

    private async Task<ProjectHourEntryDto> GetAsync(Guid id) =>
        (await ListAsync(await _db.ProjectHourEntries.Where(h => h.Id == id).Select(h => h.ProjectId).FirstAsync()))
        .Entries.Single(h => h.Id == id);

    private async Task EnsureCanEditAsync(ProjectHourEntry entry)
    {
        if (CanManage) return;
        if (entry.VolunteerId != await MyVolunteerIdAsync(_db, _currentUser))
            throw new AppException("Só a coordenação corrige as horas de outra pessoa.", 403);
    }

    private static async Task<Guid?> MyVolunteerIdAsync(EsfDbContext db, ICurrentUser currentUser) =>
        currentUser.Id is null
            ? null
            : await db.Users.Where(u => u.Id == currentUser.Id).Select(u => u.VolunteerId).FirstOrDefaultAsync();

    private static async Task EnsureTeamMemberAsync(EsfDbContext db, Guid projectId, Guid volunteerId)
    {
        if (await db.ProjectVolunteers.AnyAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId)) return;
        var name = await db.Volunteers.Where(v => v.Id == volunteerId).Select(v => v.Name).FirstOrDefaultAsync()
                   ?? throw AppException.NotFound("Voluntario");
        throw new AppException($"{name} não está na equipe do projeto. Vincule a pessoa na aba Equipe antes de lançar as horas.");
    }

    private static DateOnly ValidDate(DateOnly date)
    {
        if (date > Mapping.Today)
            throw new AppException("O dia das horas não pode estar no futuro.");
        if (date.Year < 1990) throw new AppException("Confira o dia das horas.");
        return date;
    }

    private static decimal ValidHours(decimal hours)
    {
        if (hours <= 0 || hours > MaxHoursPerDay) throw new AppException("Informe de 0,25 a 24 horas.");
        return Math.Round(hours, 2);
    }

    private static string? Clean(string? description)
    {
        var text = description?.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        return text.Length > 300 ? text[..300] : text;
    }
}
