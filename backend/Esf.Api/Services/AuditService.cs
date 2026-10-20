using System.Text.Json;
using System.Text.RegularExpressions;
using Esf.Api.Data;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>Consulta do historico de alteracoes (so administradores), com as referencias ja resolvidas.</summary>
public partial class AuditService
{
    private const int PageSize = 50;

    private readonly EsfDbContext _db;

    public AuditService(EsfDbContext db) => _db = db;

    [GeneratedRegex(@"\[\[(vol|prog):([0-9a-f]{32})\]\]")]
    private static partial Regex ReferencePattern();

    public async Task<AuditPageDto> ListAsync(AuditQuery q)
    {
        var query = _db.AuditEntries.AsNoTracking();

        if (q.ProjectId.HasValue) query = query.Where(a => a.ProjectId == q.ProjectId);
        if (q.UserId.HasValue) query = query.Where(a => a.UserId == q.UserId);
        if (!string.IsNullOrWhiteSpace(q.EntityType)) query = query.Where(a => a.EntityType == q.EntityType);
        if (q.From.HasValue)
        {
            var from = q.From.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(a => a.At >= from);
        }
        if (q.To.HasValue)
        {
            var to = q.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(a => a.At < to);
        }

        var page = Math.Max(1, q.Page);
        var rows = await query
            .OrderByDescending(a => a.At)
            .Skip((page - 1) * PageSize)
            .Take(PageSize + 1)
            .ToListAsync();
        var hasMore = rows.Count > PageSize;
        rows = rows.Take(PageSize).ToList();

        var changes = rows.ToDictionary(r => r.Id, r => r.Changes is null
            ? new List<AuditChange>()
            : JsonSerializer.Deserialize<List<AuditChange>>(r.Changes) ?? new List<AuditChange>());

        // Referencias a voluntarios e programas: nome atual (anonimizado aparece como "Voluntario removido").
        var references = rows
            .SelectMany(r => new[] { r.EntityLabel }.Concat(changes[r.Id].SelectMany(c => new[] { c.Before, c.After })))
            .SelectMany(text => ReferencePattern().Matches(text).Select(m => (Kind: m.Groups[1].Value, Id: Guid.Parse(m.Groups[2].Value))))
            .Distinct()
            .ToList();
        var volunteerIds = references.Where(r => r.Kind == "vol").Select(r => r.Id).ToList();
        var programIds = references.Where(r => r.Kind == "prog").Select(r => r.Id).ToList();
        var volunteers = await _db.Volunteers.Where(v => volunteerIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.Name);
        var programs = await _db.Programs.Where(p => programIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);

        string Resolve(string text) => ReferencePattern().Replace(text, match =>
        {
            var id = Guid.Parse(match.Groups[2].Value);
            return match.Groups[1].Value == "vol"
                ? volunteers.GetValueOrDefault(id, "voluntário excluído")
                : programs.GetValueOrDefault(id, "programa excluído");
        });

        // Quem fez: nome atual (o guardado so vale se o acesso foi excluido).
        var userIds = rows.Where(r => r.UserId.HasValue).Select(r => r.UserId!.Value).Distinct().ToList();
        var users = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = u.Volunteer != null ? u.Volunteer.Name : u.Name })
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        var projectIds = rows.Where(r => r.ProjectId.HasValue).Select(r => r.ProjectId!.Value).Distinct().ToList();
        var projects = await _db.Projects.Where(p => projectIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);

        var items = rows.Select(r => new AuditEntryDto(
                r.Id,
                r.At,
                r.UserId,
                r.UserId.HasValue ? users.GetValueOrDefault(r.UserId.Value, r.UserName) : r.UserName,
                r.Action,
                r.EntityType,
                r.EntityId,
                Resolve(r.EntityLabel),
                r.ProjectId,
                r.ProjectId.HasValue ? projects.GetValueOrDefault(r.ProjectId.Value) : null,
                changes[r.Id].Select(c => new AuditChange(c.Field, Resolve(c.Before), Resolve(c.After))).ToList()))
            .ToList();

        return new AuditPageDto(items, hasMore);
    }
}
