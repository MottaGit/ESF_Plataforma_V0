using System.Linq.Expressions;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;

namespace Esf.Api.Services;

/// <summary>
/// Regra unica dos resultados somados, usada na visao do programa, no PDF de varios projetos, na pagina publica e no
/// painel nacional: os indicadores nacionais somam pelo vinculo e os do modelo do programa pelo nome (sem diferenciar
/// maiusculas nem acentos). So somam os valores informados (vazio e "nao informado", diferente de zero), e cada
/// resultado diz em quantos projetos foi informado.
/// </summary>
public static class ResultTotals
{
    /// <summary>
    /// Projetos que entram nos resultados acumulados: todos menos os cancelados. Os arquivados entram, porque arquivar
    /// so tira o projeto da lista; o que ele entregou continua sendo resultado.
    /// </summary>
    public static readonly Expression<Func<Project, bool>> CountsForResults = p => p.Status != ProjectStatus.Cancelado;

    /// <summary>Um indicador de um projeto, com o que a soma precisa.</summary>
    public record Item(Guid ProjectId, string Name, string? Unit, decimal? Value, Guid? NationalIndicatorId);

    /// <summary>Indicador padrao do modelo do programa (os ligados a um nacional ja entram pelo nacional).</summary>
    public record Template(string Name, string? Unit, Guid? NationalIndicatorId);

    /// <summary>
    /// Resultado somado. Value fica null quando nenhum projeto informou; Informed e Projects dizem em quantos projetos
    /// foi informado e quantos tem o indicador.
    /// </summary>
    public record Total(string Name, string? Unit, decimal? Value, int Informed, int Projects, Guid? NationalIndicatorId);

    /// <summary>
    /// Nacionais primeiro (em ordem de nome), depois os do modelo na ordem do modelo. Indicador do modelo que nenhum
    /// projeto tem sai com Projects = 0 (quem chama decide se mostra).
    /// </summary>
    public static List<Total> Compute(IEnumerable<Item> indicators, IEnumerable<Template> templates)
    {
        var all = indicators.ToList();

        var results = all
            .Where(i => i.NationalIndicatorId != null)
            .GroupBy(i => i.NationalIndicatorId)
            .Select(g => Build(g.First().Name, g.First().Unit, g.ToList(), g.Key))
            .OrderBy(r => r.Name)
            .ToList();

        foreach (var template in templates.Where(t => t.NationalIndicatorId == null))
        {
            var key = SearchText.Fold(template.Name.Trim());
            var matching = all
                .Where(i => i.NationalIndicatorId == null && SearchText.Fold(i.Name.Trim()) == key)
                .ToList();
            results.Add(Build(template.Name, template.Unit, matching, null));
        }

        return results;
    }

    /// <summary>Soma so os valores informados; sem nenhum, o total fica null (nao informado), nunca zero.</summary>
    public static Total Build(string name, string? unit, IReadOnlyCollection<Item> items, Guid? nationalId)
    {
        var informed = items.Where(i => i.Value != null).ToList();
        return new Total(
            name,
            unit,
            informed.Count > 0 ? informed.Sum(i => i.Value!.Value) : null,
            informed.Select(i => i.ProjectId).Distinct().Count(),
            items.Select(i => i.ProjectId).Distinct().Count(),
            nationalId);
    }

    /// <summary>"informado em 3 de 5 projetos" quando falta algum projeto informar; null quando todos informaram.</summary>
    public static string? Coverage(int informed, int projects) =>
        informed >= projects ? null : $"informado em {informed} de {projects} {(projects == 1 ? "projeto" : "projetos")}";
}
