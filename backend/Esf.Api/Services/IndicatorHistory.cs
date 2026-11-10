using Esf.Api.Common;
using Esf.Api.Domain.Entities;

namespace Esf.Api.Services;

/// <summary>
/// Leitura do historico dos indicadores (IndicatorValueChange): o valor que valia num dia e o numero de cada indicador
/// num relatorio com periodo (o do fim do periodo e o da vespera do inicio, para dizer quanto mudou dentro dele).
/// </summary>
public static class IndicatorHistory
{
    /// <summary>A mudanca que valia no fim do dia (de Brasilia); sem nenhuma ate ali, null (nao informado).</summary>
    public static IndicatorValueChange? At(IEnumerable<IndicatorValueChange> changes, DateOnly day) =>
        changes
            .Where(c => TextHelpers.BrasiliaDay(c.ChangedAt) <= day)
            .OrderBy(c => c.ChangedAt)
            .LastOrDefault();

    /// <summary>
    /// Numero de cada indicador no relatorio. Periodo que vai ate hoje (ou sem fim): o valor de hoje. Terminando antes:
    /// o que valia no ultimo dia do periodo. Com inicio, Start e o que valia na vespera, para a mudanca no periodo.
    /// </summary>
    public static Dictionary<Guid, IndicatorFigure> Figures(
        IEnumerable<Indicator> indicators,
        IEnumerable<IndicatorValueChange> history,
        DateOnly? from,
        DateOnly? to,
        DateOnly today)
    {
        var byIndicator = history.ToLookup(c => c.IndicatorId);
        var figures = new Dictionary<Guid, IndicatorFigure>();

        foreach (var indicator in indicators)
        {
            var changes = byIndicator[indicator.Id].ToList();
            // Valor sem historico (a migracao cobre os antigos; aqui so por garantia): vale desde a ultima mudanca
            // conhecida, como na migracao.
            if (changes.Count == 0 && indicator.Value is not null)
                changes.Add(new IndicatorValueChange
                {
                    IndicatorId = indicator.Id,
                    Value = indicator.Value,
                    ChangedAt = indicator.ValueUpdatedAt ?? indicator.CreatedAt
                });

            decimal? value = indicator.Value;
            var updatedAt = indicator.ValueUpdatedAt;
            if (to is { } last && last < today)
            {
                var atEnd = At(changes, last);
                value = atEnd?.Value;
                updatedAt = atEnd?.Value is null ? null : atEnd.ChangedAt;
            }

            var start = from is { } first ? At(changes, first.AddDays(-1))?.Value : null;
            figures[indicator.Id] = new IndicatorFigure(value, updatedAt, start);
        }

        return figures;
    }
}

/// <summary>
/// Numero de um indicador no relatorio: o valor (no fim do periodo), desde quando ele vale e o da vespera do inicio do
/// periodo (null sem inicio, ou quando ainda nao estava informado).
/// </summary>
public record IndicatorFigure(decimal? Value, DateTime? UpdatedAt, decimal? Start)
{
    /// <summary>Quanto mudou no periodo: o que nao estava informado no comeco conta como zero.</summary>
    public decimal Change => (Value ?? 0) - (Start ?? 0);
}
