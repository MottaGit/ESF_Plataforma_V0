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
            .OrderBy(i => i.NationalIndicatorId == null)
            .ThenBy(i => i.CreatedAt)
            .ThenBy(i => i.Name)
            .ToListAsync();

        return indicators.Select(Mapping.ToDto).ToList();
    }

    public async Task<IndicatorDto> CreateAsync(Guid projectId, SaveIndicatorRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var indicator = new Indicator { ProjectId = projectId, CreatedAt = DateTime.UtcNow };
        await ApplyAsync(indicator, request);

        _db.Indicators.Add(indicator);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(indicator);
    }

    public async Task<IndicatorDto> UpdateAsync(Guid id, SaveIndicatorRequest request)
    {
        var indicator = await _db.Indicators.FirstOrDefaultAsync(i => i.Id == id) ?? throw AppException.NotFound("Indicador");
        if (request.NationalIndicatorId != indicator.NationalIndicatorId && await IsMandatoryAsync(indicator))
            throw new AppException("Indicador nacional é obrigatório em todo projeto: só o valor pode mudar.");

        await ApplyAsync(indicator, request);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(indicator);
    }

    public async Task DeleteAsync(Guid id)
    {
        var indicator = await _db.Indicators.FirstOrDefaultAsync(i => i.Id == id) ?? throw AppException.NotFound("Indicador");
        if (await IsMandatoryAsync(indicator))
            throw new AppException(
                "Indicador nacional é obrigatório em todo projeto e não pode ser excluído. Se o número ainda não foi apurado, deixe o valor em branco.");

        _db.Indicators.Remove(indicator);
        await _db.SaveChangesAsync();
    }

    /// <summary>Ligado a um nacional ativo: fica no projeto e continua ligado (arquivado deixa de ser obrigatorio).</summary>
    private Task<bool> IsMandatoryAsync(Indicator indicator) =>
        indicator.NationalIndicatorId is { } nationalId
            ? _db.NationalIndicators.AnyAsync(n => n.Id == nationalId && !n.IsArchived)
            : Task.FromResult(false);

    /// <summary>
    /// Indicador nacional escolhido: nome e unidade vem dele, e cada projeto o tem uma vez so (senao a soma nacional
    /// contaria duas vezes). Sem nacional: indicador especifico do projeto, com o nome e a unidade informados.
    /// </summary>
    private async Task ApplyAsync(Indicator indicator, SaveIndicatorRequest r)
    {
        // So muda a data quando o numero muda (corrigir o nome nao "atualiza" o resultado).
        if (indicator.Value != r.Value) indicator.ValueUpdatedAt = DateTime.UtcNow;
        indicator.Value = r.Value;

        if (r.NationalIndicatorId.HasValue)
        {
            var national = await NationalIndicatorService.FindForUseAsync(_db, r.NationalIndicatorId.Value, indicator.NationalIndicatorId);
            if (await _db.Indicators.AnyAsync(i =>
                    i.ProjectId == indicator.ProjectId && i.NationalIndicatorId == national.Id && i.Id != indicator.Id))
                throw AppException.Conflict("Este projeto já tem este indicador nacional.");

            indicator.NationalIndicatorId = national.Id;
            indicator.Name = national.Name;
            indicator.Unit = national.Unit;
            return;
        }

        indicator.NationalIndicatorId = null;
        indicator.Name = r.Name.Trim();
        indicator.Unit = string.IsNullOrWhiteSpace(r.Unit) ? null : r.Unit.Trim();
    }
}
