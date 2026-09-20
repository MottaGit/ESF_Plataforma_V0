using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class IndicatorService
{
    private readonly EsfDbContext _db;

    public IndicatorService(EsfDbContext db) => _db = db;

    public async Task<List<IndicatorDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var indicators = await _db.Indicators
            .AsNoTracking()
            .Where(i => i.ProjectId == projectId)
            .OrderBy(i => i.CreatedAt)
            .ToListAsync();

        return indicators.Select(Mapping.ToDto).ToList();
    }

    public async Task<IndicatorDto> CreateAsync(Guid projectId, SaveIndicatorRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var indicator = new Indicator { ProjectId = projectId, CreatedAt = DateTime.UtcNow };
        Apply(indicator, request);

        _db.Indicators.Add(indicator);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(indicator);
    }

    public async Task<IndicatorDto> UpdateAsync(Guid id, SaveIndicatorRequest request)
    {
        var indicator = await _db.Indicators.FirstOrDefaultAsync(i => i.Id == id) ?? throw AppException.NotFound("Indicador");

        Apply(indicator, request);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(indicator);
    }

    public async Task DeleteAsync(Guid id)
    {
        var indicator = await _db.Indicators.FirstOrDefaultAsync(i => i.Id == id) ?? throw AppException.NotFound("Indicador");

        _db.Indicators.Remove(indicator);
        await _db.SaveChangesAsync();
    }

    private static void Apply(Indicator indicator, SaveIndicatorRequest r)
    {
        indicator.Name = r.Name.Trim();
        indicator.Unit = string.IsNullOrWhiteSpace(r.Unit) ? null : r.Unit.Trim();
        indicator.Value = r.Value!.Value;
    }
}
