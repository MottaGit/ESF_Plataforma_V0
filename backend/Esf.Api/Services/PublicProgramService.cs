using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Pagina publica do programa (rota sem login): o que parceiros e financiadores podem ver. So dados objetivos dos
/// projetos (nome, situacao, local por bairro e cidade, periodo, progresso e indicadores), os resultados somados e
/// numeros da equipe; nunca endereco, pessoas, tarefas, texto de registros, fotos ou arquivos.
/// </summary>
public class PublicProgramService
{
    /// <summary>Limite de acessos por minuto de cada endereco a rota publica.</summary>
    public const string RateLimitPolicy = "public-page";

    /// <summary>
    /// Ordem dos cartoes de projeto. Cancelados nunca aparecem; arquivados nao ganham cartao, mas entram nos numeros e
    /// nos resultados (arquivar so tira o projeto da lista; o que ele entregou continua sendo resultado).
    /// </summary>
    private static readonly ProjectStatus[] Shown =
        { ProjectStatus.EmAndamento, ProjectStatus.Pausado, ProjectStatus.Planejamento, ProjectStatus.Concluido };

    private readonly EsfDbContext _db;

    public PublicProgramService(EsfDbContext db) => _db = db;

    public async Task<PublicProgramDto> GetAsync(string token)
    {
        var unavailable = new AppException("Esta página não existe ou foi desligada pelo núcleo.", StatusCodes.Status404NotFound);
        if (string.IsNullOrWhiteSpace(token) || token.Length > 40) throw unavailable;

        // Rota publica: o programa e achado pelo codigo em qualquer nucleo (unico ponto que ignora o filtro aqui) e,
        // dali em diante, as consultas ficam presas ao nucleo dele pelo filtro global.
        var program = await _db.Programs.IgnoreQueryFilters().AsNoTracking()
                          .FirstOrDefaultAsync(p => p.PublicToken == token)
                      ?? throw unavailable;
        _db.OrganizationOverride = program.OrganizationId;

        var nucleo = await _db.Organizations.AsNoTracking().FirstAsync(o => o.Id == program.OrganizationId);

        var projects = await _db.Projects.AsNoTracking()
            .Where(p => p.ProgramId == program.Id)
            .Where(ResultTotals.CountsForResults)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Status,
                p.IsArchived,
                p.District,
                p.City,
                p.State,
                p.StartDate,
                p.EndDateForecast,
                p.ClosedOn,
                Tasks = p.Activities.Count,
                TasksDone = p.Activities.Count(a => a.Status == ActivityStatus.Concluida),
                LastUpdateAt = p.Updates.Max(u => (DateTime?)u.CreatedAt),
                Indicators = p.Indicators
                    .Where(i => i.Value != null)
                    .OrderBy(i => i.NationalIndicatorId == null)
                    .ThenBy(i => i.CreatedAt)
                    .ThenBy(i => i.Name)
                    .Select(i => new { i.Name, i.Unit, Value = i.Value!.Value, i.NationalIndicatorId })
                    .ToList()
            })
            .ToListAsync();

        var ids = projects.Select(p => p.Id).ToList();
        var volunteers = await _db.ProjectVolunteers.Where(pv => ids.Contains(pv.ProjectId))
            .Select(pv => pv.VolunteerId).Distinct().CountAsync();
        var hours = await _db.ProjectHourEntries.Where(h => ids.Contains(h.ProjectId))
            .SumAsync(h => (decimal?)h.Hours) ?? 0;

        // Resultados somados pela regra unica (ResultTotals): nacionais pelo vinculo, depois os do modelo do programa
        // pelo nome. So entra o que tem algum valor informado.
        var templates = await _db.ProgramTemplateIndicators.AsNoTracking()
            .Where(t => t.ProgramId == program.Id)
            .OrderBy(t => t.Position)
            .Select(t => new ResultTotals.Template(t.Name, t.Unit, t.NationalIndicatorId))
            .ToListAsync();
        var results = ResultTotals
            .Compute(
                projects.SelectMany(p => p.Indicators.Select(i =>
                    new ResultTotals.Item(p.Id, i.Name, i.Unit, i.Value, i.NationalIndicatorId))),
                templates)
            .Where(r => r.Value != null)
            .Select(r => new PublicIndicatorDto(r.Name, r.Unit, r.Value!.Value, r.NationalIndicatorId != null))
            .ToList();

        var shownProjects = projects
            .Where(p => !p.IsArchived)
            .OrderBy(p => Array.IndexOf(Shown, p.Status))
            .ThenByDescending(p => p.StartDate)
            .ThenBy(p => p.Name)
            .Select(p => new PublicProjectDto(
                p.Name, p.Status, p.District, p.City, p.State, p.StartDate, p.EndDateForecast,
                p.Tasks == 0 && p.Status != ProjectStatus.Concluido ? null : Mapping.ProjectProgress(p.Status, p.Tasks, p.TasksDone),
                p.Indicators.Select(i => new PublicIndicatorDto(i.Name, i.Unit, i.Value, i.NationalIndicatorId != null)).ToList(),
                p.LastUpdateAt,
                p.ClosedOn))
            .ToList();

        return new PublicProgramDto(
            program.Name,
            program.Icon,
            program.Color,
            program.PublicDescription,
            new PublicNucleoDto(nucleo.Name, nucleo.LogoUrl, nucleo.Cnpj, nucleo.Email, nucleo.City, nucleo.State),
            new PublicProgramTotalsDto(
                projects.Count(p => p.Status == ProjectStatus.Concluido),
                projects.Count(p => p.Status == ProjectStatus.EmAndamento),
                projects.Count(p => p.Status == ProjectStatus.Planejamento),
                projects.Count(p => p.Status == ProjectStatus.Pausado),
                volunteers,
                hours),
            results,
            shownProjects,
            projects.Max(p => p.LastUpdateAt));
    }
}
