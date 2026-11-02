using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Indicadores nacionais: a gestao nacional define (nome, unidade, como contar) e os nucleos escolhem nos projetos e
/// nos modelos de programa, em vez de criar um com outro nome. E o vinculo que permite somar entre nucleos.
/// </summary>
public class NationalIndicatorService
{
    private readonly EsfDbContext _db;

    public NationalIndicatorService(EsfDbContext db) => _db = db;

    public Task<List<NationalIndicatorDto>> ListAsync(bool includeArchived) =>
        _db.NationalIndicators.AsNoTracking()
            .Where(n => includeArchived || !n.IsArchived)
            .OrderBy(n => n.Name)
            .Select(n => new NationalIndicatorDto(n.Id, n.Name, n.Unit, n.Description, n.IsArchived))
            .ToListAsync();

    public async Task<NationalIndicatorDto> CreateAsync(SaveNationalIndicatorRequest request)
    {
        var indicator = new NationalIndicator();
        await ApplyAsync(indicator, request);
        _db.NationalIndicators.Add(indicator);
        await _db.SaveChangesAsync();
        return ToDto(indicator);
    }

    /// <summary>Nome e unidade novos valem para todos os nucleos: os indicadores ligados acompanham.</summary>
    public async Task<NationalIndicatorDto> UpdateAsync(Guid id, SaveNationalIndicatorRequest request)
    {
        var indicator = await FindAsync(id);
        await ApplyAsync(indicator, request);

        _db.AllOrganizations = true;
        foreach (var linked in await _db.Indicators.Where(i => i.NationalIndicatorId == id).ToListAsync())
        {
            linked.Name = indicator.Name;
            linked.Unit = indicator.Unit;
        }
        foreach (var linked in await _db.ProgramTemplateIndicators.Where(t => t.NationalIndicatorId == id).ToListAsync())
        {
            linked.Name = indicator.Name;
            linked.Unit = indicator.Unit;
        }
        await _db.SaveChangesAsync();
        _db.AllOrganizations = false;

        return ToDto(indicator);
    }

    /// <summary>Arquivar tira das opcoes para indicadores novos; os ja ligados continuam (e continuam somando).</summary>
    public async Task<NationalIndicatorDto> SetArchivedAsync(Guid id, bool archived)
    {
        var indicator = await FindAsync(id);
        indicator.IsArchived = archived;
        await _db.SaveChangesAsync();
        return ToDto(indicator);
    }

    /// <summary>
    /// Indicador nacional que um nucleo quer usar: precisa existir e estar ativo (um arquivado so vale para quem ja
    /// estava ligado a ele).
    /// </summary>
    public static async Task<NationalIndicator> FindForUseAsync(EsfDbContext db, Guid id, Guid? currentlyLinked)
    {
        var indicator = await db.NationalIndicators.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id)
                        ?? throw new AppException("O indicador nacional informado nao existe.");
        if (indicator.IsArchived && indicator.Id != currentlyLinked)
            throw new AppException("Este indicador nacional foi arquivado pela gestao nacional e nao pode ser usado em indicadores novos.");
        return indicator;
    }

    private async Task<NationalIndicator> FindAsync(Guid id) =>
        await _db.NationalIndicators.FirstOrDefaultAsync(n => n.Id == id) ?? throw AppException.NotFound("Indicador nacional");

    private async Task ApplyAsync(NationalIndicator indicator, SaveNationalIndicatorRequest request)
    {
        var name = request.Name.Trim();
        if (await _db.NationalIndicators.AnyAsync(n => n.Id != indicator.Id && n.Name.ToLower() == name.ToLower()))
            throw AppException.Conflict("Ja existe um indicador nacional com este nome.");

        indicator.Name = name;
        indicator.Unit = string.IsNullOrWhiteSpace(request.Unit) ? null : request.Unit.Trim();
        indicator.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
    }

    private static NationalIndicatorDto ToDto(NationalIndicator n) => new(n.Id, n.Name, n.Unit, n.Description, n.IsArchived);
}
