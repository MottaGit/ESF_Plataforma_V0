using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Busca geral (campo do topo): projetos, programas, atividades, voluntarios e relatos, sem diferenciar acentos nem
/// maiusculas. Documentos assinados e o historico de alteracoes ficam de fora.
/// </summary>
public class SearchService
{
    private const int PerType = 5;
    private const string Escape = "\\";

    private readonly EsfDbContext _db;

    public SearchService(EsfDbContext db) => _db = db;

    public async Task<SearchResultsDto> SearchAsync(string? query)
    {
        var term = SearchText.Fold((query ?? string.Empty).Trim());
        if (term.Length < 2)
            return new SearchResultsDto(new(), new(), new(), new(), new());

        var pattern = SearchText.ContainsPattern(term);

        var projects = await _db.Projects.AsNoTracking()
            .Where(p => EF.Functions.Like(EsfDbContext.Fold(p.Name), pattern, Escape)
                        || (p.Beneficiaries != null && EF.Functions.Like(EsfDbContext.Fold(p.Beneficiaries), pattern, Escape))
                        || (p.District != null && EF.Functions.Like(EsfDbContext.Fold(p.District), pattern, Escape))
                        || (p.City != null && EF.Functions.Like(EsfDbContext.Fold(p.City), pattern, Escape)))
            // Primeiro os que tem o termo no nome; arquivados por ultimo.
            .OrderByDescending(p => EF.Functions.Like(EsfDbContext.Fold(p.Name), pattern, Escape))
            .ThenBy(p => p.IsArchived)
            .ThenByDescending(p => p.UpdatedAt)
            .Take(PerType)
            .Select(p => new SearchProjectDto(p.Id, p.Name, p.Program!.Name, p.Program.Icon, p.Program.Color, p.Status, p.IsArchived))
            .ToListAsync();

        var programs = await _db.Programs.AsNoTracking()
            .Where(p => EF.Functions.Like(EsfDbContext.Fold(p.Name), pattern, Escape))
            .OrderBy(p => p.Status).ThenBy(p => p.Name)
            .Take(PerType)
            .Select(p => new SearchProgramDto(p.Id, p.Name, p.Icon, p.Color, p.Status == ProgramStatus.Arquivado))
            .ToListAsync();

        var activities = await _db.Activities.AsNoTracking()
            .Where(a => EF.Functions.Like(EsfDbContext.Fold(a.Title), pattern, Escape)
                        || (a.Description != null && EF.Functions.Like(EsfDbContext.Fold(a.Description), pattern, Escape)))
            // Em aberto primeiro, depois as mais recentes.
            .OrderBy(a => a.Status == ActivityStatus.Concluida)
            .ThenByDescending(a => EF.Functions.Like(EsfDbContext.Fold(a.Title), pattern, Escape))
            .ThenByDescending(a => a.CreatedAt)
            .Take(PerType)
            .Select(a => new SearchActivityDto(a.Id, a.Title, a.ProjectId, a.Project!.Name, a.Status))
            .ToListAsync();

        var volunteers = await _db.Volunteers.AsNoTracking()
            .Where(v => v.AnonymizedAt == null && EF.Functions.Like(EsfDbContext.Fold(v.Name), pattern, Escape))
            .OrderBy(v => v.Status).ThenBy(v => v.Name)
            .Take(PerType)
            .Select(v => new SearchVolunteerDto(v.Id, v.Name, v.Sector,
                v.PhotoStoredName != null ? Mapping.UploadsUrlPrefix + "/" + v.PhotoStoredName : null))
            .ToListAsync();

        var updates = await _db.ProjectUpdates.AsNoTracking()
            .Where(u => EF.Functions.Like(EsfDbContext.FoldHtml(u.Text), pattern, Escape))
            .OrderByDescending(u => u.CreatedAt)
            .Take(PerType)
            .Select(u => new { u.Id, u.ProjectId, ProjectName = u.Project!.Name, u.CreatedAt, u.Text })
            .ToListAsync();

        return new SearchResultsDto(
            projects,
            programs,
            activities,
            volunteers,
            updates.Select(u => new SearchUpdateDto(u.Id, u.ProjectId, u.ProjectName, u.CreatedAt,
                Snippet(RichText.ToPlainText(u.Text), term))).ToList());
    }

    /// <summary>Trecho de ~120 caracteres em volta da primeira ocorrencia do termo.</summary>
    private static string Snippet(string text, string term)
    {
        var plain = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var at = SearchText.Fold(plain).IndexOf(term, StringComparison.Ordinal);
        if (plain.Length <= 120) return plain;
        var start = Math.Max(0, Math.Min(at < 0 ? 0 : at - 40, plain.Length - 120));
        var cut = plain.Substring(start, Math.Min(120, plain.Length - start)).Trim();
        return (start > 0 ? "…" : "") + cut + (start + 120 < plain.Length ? "…" : "");
    }
}
