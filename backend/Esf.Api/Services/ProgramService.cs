using System.Linq.Expressions;
using System.Security.Cryptography;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ProgramService
{
    private readonly EsfDbContext _db;

    public ProgramService(EsfDbContext db) => _db = db;

    /// <summary>Programa com as contagens de projetos (em uma consulta so).</summary>
    private static readonly Expression<Func<ProjectProgram, ProgramDto>> ToDto = p => new ProgramDto(
        p.Id,
        p.Name,
        p.Status,
        p.CreatedAt,
        p.Projects.Count,
        p.Projects.Count(x => !x.IsArchived
                              && (x.Status == ProjectStatus.Planejamento || x.Status == ProjectStatus.EmAndamento
                                  || x.Status == ProjectStatus.Pausado)),
        p.Projects.Count(x => x.Status == ProjectStatus.Concluido),
        p.Icon,
        p.Color,
        p.Description,
        p.Objective,
        p.Audience,
        p.TemplateActivities.Count,
        p.TemplateIndicators.Count,
        p.PublicToken != null,
        new List<string>(),
        new List<ProgramResultDto>());

    public async Task<List<ProgramDto>> ListAsync(bool onlyActive)
    {
        var query = _db.Programs.AsNoTracking();

        if (onlyActive)
            query = query.Where(p => p.Status == ProgramStatus.Ativo);

        return await WithResultsAsync(await query
            .OrderBy(p => p.Name)
            .Select(ToDto)
            .ToListAsync());
    }

    public async Task<ProgramDto> GetAsync(Guid id)
    {
        var program = await _db.Programs.AsNoTracking().Where(p => p.Id == id).Select(ToDto).FirstOrDefaultAsync()
                      ?? throw AppException.NotFound("Programa");
        return (await WithResultsAsync(new List<ProgramDto> { program }))[0];
    }

    /// <summary>
    /// Resultados de cada programa pela regra unica (ResultTotals): os nacionais e os indicadores padrao do modelo,
    /// somados nos projetos do programa que nao foram cancelados (os arquivados entram), so com os valores informados.
    /// Junto, os nomes dos parceiros de cada programa.
    /// </summary>
    private async Task<List<ProgramDto>> WithResultsAsync(List<ProgramDto> programs)
    {
        var ids = programs.Select(p => p.Id).ToList();
        var partners = await _db.ProgramPartners.AsNoTracking()
            .Where(x => ids.Contains(x.ProgramId))
            .OrderBy(x => x.Position)
            .Select(x => new { x.ProgramId, x.Name })
            .ToListAsync();
        var templates = await _db.ProgramTemplateIndicators.AsNoTracking()
            .Where(t => ids.Contains(t.ProgramId))
            .OrderBy(t => t.Position)
            .Select(t => new { t.ProgramId, t.Name, t.Unit, t.NationalIndicatorId })
            .ToListAsync();

        // Mesmo criterio de ResultTotals.CountsForResults, aqui pela navegacao do indicador ate o projeto.
        var indicators = await _db.Indicators.AsNoTracking()
            .Where(i => ids.Contains(i.Project!.ProgramId) && i.Project.Status != ProjectStatus.Cancelado)
            .Select(i => new { i.Project!.ProgramId, i.ProjectId, i.Name, i.Unit, i.Value, i.NationalIndicatorId })
            .ToListAsync();

        return programs
            .Select(p => p with
            {
                Partners = partners.Where(x => x.ProgramId == p.Id).Select(x => x.Name).ToList(),
                Results = ResultTotals
                    .Compute(
                        indicators.Where(i => i.ProgramId == p.Id)
                            .Select(i => new ResultTotals.Item(i.ProjectId, i.Name, i.Unit, i.Value, i.NationalIndicatorId)),
                        templates.Where(t => t.ProgramId == p.Id)
                            .Select(t => new ResultTotals.Template(t.Name, t.Unit, t.NationalIndicatorId)))
                    .Select(r => new ProgramResultDto(r.Name, r.Unit, r.Value, r.Informed, r.Projects,
                        r.NationalIndicatorId != null))
                    .ToList()
            })
            .ToList();
    }

    public async Task<ProgramDto> CreateAsync(SaveProgramRequest request)
    {
        var name = request.Name.Trim();
        await EnsureNameAvailableAsync(name, null);

        var program = new ProjectProgram
        {
            Name = name,
            Icon = ProgramAppearance.IconOrDefault(request.Icon),
            Color = ProgramAppearance.ColorOrDefault(request.Color)
        };
        _db.Programs.Add(program);
        await _db.SaveChangesAsync();

        return await GetAsync(program.Id);
    }

    /// <summary>
    /// Editar programa › Sobre: nome, icone, cor e a ficha (o que faz, objetivo, para quem); tambem arquiva/reativa.
    /// Arquivado, o programa some das opcoes de novos projetos.
    /// </summary>
    public async Task<ProgramDto> UpdateAsync(Guid id, UpdateProgramRequest request)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Programa");

        var name = request.Name.Trim();
        await EnsureNameAvailableAsync(name, id);

        program.Name = name;
        program.Status = request.Status!.Value;
        program.Icon = ProgramAppearance.IconOrDefault(request.Icon ?? program.Icon);
        program.Color = ProgramAppearance.ColorOrDefault(request.Color ?? program.Color);
        program.Description = Clean(request.Description);
        program.Objective = Clean(request.Objective);
        program.Audience = Clean(request.Audience);
        await _db.SaveChangesAsync();

        return await GetAsync(id);
    }

    /// <summary>Pagina publica do programa (coordenacao): se esta ligada e o codigo do link.</summary>
    public async Task<ProgramPublicPageDto> GetPublicPageAsync(Guid id)
    {
        var program = await _db.Programs.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id)
                      ?? throw AppException.NotFound("Programa");
        return new ProgramPublicPageDto(program.PublicToken != null, program.PublicToken);
    }

    /// <summary>
    /// Liga ou desliga a pagina publica. Ligar cria o codigo do link; desligar apaga o codigo, entao o link enviado
    /// deixa de abrir, e ligar de novo gera um link novo.
    /// </summary>
    public async Task<ProgramPublicPageDto> SavePublicPageAsync(Guid id, SaveProgramPublicPageRequest request)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Programa");

        if (!request.Enabled) program.PublicToken = null;
        else program.PublicToken ??= WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(16));
        await _db.SaveChangesAsync();

        return new ProgramPublicPageDto(program.PublicToken != null, program.PublicToken);
    }

    public async Task<ProgramTemplateDto> GetTemplateAsync(Guid id)
    {
        var program = await _db.Programs.AsNoTracking()
                          .Include(p => p.TemplateActivities)
                          .Include(p => p.TemplateIndicators)
                          .AsSplitQuery()
                          .FirstOrDefaultAsync(p => p.Id == id)
                      ?? throw AppException.NotFound("Programa");
        return ToTemplateDto(program);
    }

    /// <summary>
    /// Grava o modelo inteiro: itens com Id sao atualizados, sem Id sao criados e os que sairam da lista sao
    /// apagados. Os projetos que ja existem nao mudam.
    /// </summary>
    public async Task<ProgramTemplateDto> SaveTemplateAsync(Guid id, SaveProgramTemplateRequest request)
    {
        var program = await _db.Programs
                          .Include(p => p.TemplateActivities)
                          .Include(p => p.TemplateIndicators)
                          .AsSplitQuery()
                          .FirstOrDefaultAsync(p => p.Id == id)
                      ?? throw AppException.NotFound("Programa");

        var activities = program.TemplateActivities.ToDictionary(a => a.Id);
        for (var i = 0; i < request.Activities.Count; i++)
        {
            var item = request.Activities[i];
            var activity = item.Id.HasValue && activities.Remove(item.Id.Value, out var found)
                ? found
                : _db.ProgramTemplateActivities.Add(new ProgramTemplateActivity { ProgramId = id }).Entity;
            activity.Position = i;
            activity.Title = item.Title.Trim();
            activity.Description = Clean(item.Description);
            activity.Priority = item.Priority!.Value;
            activity.DueDays = item.DueDays;
        }
        _db.ProgramTemplateActivities.RemoveRange(activities.Values);

        var indicators = program.TemplateIndicators.ToDictionary(x => x.Id);
        for (var i = 0; i < request.Indicators.Count; i++)
        {
            var item = request.Indicators[i];
            var indicator = item.Id.HasValue && indicators.Remove(item.Id.Value, out var found)
                ? found
                : _db.ProgramTemplateIndicators.Add(new ProgramTemplateIndicator { ProgramId = id }).Entity;
            indicator.Position = i;
            indicator.Target = item.Target;

            // Indicador nacional: nome e unidade vem dele (e os projetos novos nascem ligados).
            if (item.NationalIndicatorId.HasValue)
            {
                var national = await NationalIndicatorService.FindForUseAsync(_db, item.NationalIndicatorId.Value,
                    indicator.NationalIndicatorId);
                indicator.NationalIndicatorId = national.Id;
                indicator.Name = national.Name;
                indicator.Unit = national.Unit;
                continue;
            }

            indicator.NationalIndicatorId = null;
            indicator.Name = item.Name.Trim();
            indicator.Unit = Clean(item.Unit);
        }
        _db.ProgramTemplateIndicators.RemoveRange(indicators.Values);

        await _db.SaveChangesAsync();
        return await GetTemplateAsync(id);
    }

    /// <summary>Parceiros do programa, na ordem da lista (com o contato: so para quem e do nucleo).</summary>
    public async Task<List<ProgramPartnerDto>> GetPartnersAsync(Guid id)
    {
        if (!await _db.Programs.AnyAsync(p => p.Id == id)) throw AppException.NotFound("Programa");

        return await _db.ProgramPartners.AsNoTracking()
            .Where(x => x.ProgramId == id)
            .OrderBy(x => x.Position)
            .Select(x => new ProgramPartnerDto(x.Id, x.Name, x.Role, x.ContactName, x.Email, x.Phone, x.Notes))
            .ToListAsync();
    }

    /// <summary>
    /// Grava a lista inteira de parceiros: com Id sao atualizados, sem Id sao criados e os que sairam da lista sao
    /// apagados. A ordem da lista e a da pagina publica e do PDF.
    /// </summary>
    public async Task<List<ProgramPartnerDto>> SavePartnersAsync(Guid id, SaveProgramPartnersRequest request)
    {
        var program = await _db.Programs
                          .Include(p => p.Partners)
                          .FirstOrDefaultAsync(p => p.Id == id)
                      ?? throw AppException.NotFound("Programa");

        var existing = program.Partners.ToDictionary(x => x.Id);
        for (var i = 0; i < request.Partners.Count; i++)
        {
            var item = request.Partners[i];
            var partner = item.Id.HasValue && existing.Remove(item.Id.Value, out var found)
                ? found
                : _db.ProgramPartners.Add(new ProgramPartner { ProgramId = id, Program = program }).Entity;
            partner.Position = i;
            partner.Name = item.Name.Trim();
            partner.Role = Clean(item.Role);
            partner.ContactName = Clean(item.ContactName);
            partner.Email = Clean(item.Email);
            partner.Phone = Clean(item.Phone);
            partner.Notes = Clean(item.Notes);
        }
        _db.ProgramPartners.RemoveRange(existing.Values);

        await _db.SaveChangesAsync();
        return await GetPartnersAsync(id);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ProgramTemplateDto ToTemplateDto(ProjectProgram p) => new(
        p.TemplateActivities.OrderBy(a => a.Position)
            .Select(a => new TemplateActivityDto(a.Id, a.Title, a.Description, a.Priority, a.DueDays)).ToList(),
        p.TemplateIndicators.OrderBy(x => x.Position)
            .Select(x => new TemplateIndicatorDto(x.Id, x.Name, x.Unit, x.NationalIndicatorId, x.Target)).ToList());

    /// <summary>So exclui programa sem projetos (criado por engano, por exemplo); com projetos, arquive.</summary>
    public async Task DeleteAsync(Guid id)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Programa");

        if (await _db.Projects.AnyAsync(p => p.ProgramId == id))
            throw AppException.Conflict("Este programa tem projetos. Arquive-o em vez de excluir.");

        _db.Programs.Remove(program);
        await _db.SaveChangesAsync();
    }

    private async Task EnsureNameAvailableAsync(string name, Guid? exceptId)
    {
        if (await _db.Programs.AnyAsync(p => p.Id != exceptId && EF.Functions.ILike(p.Name, name)))
            throw AppException.Conflict("Já existe um programa com este nome.");
    }
}
