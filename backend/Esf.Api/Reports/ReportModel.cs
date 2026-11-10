using Esf.Api.Common;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;

namespace Esf.Api.Reports;

public record ReportModel
{
    public Organization Organization { get; init; } = new();
    public List<Project> Projects { get; init; } = new();
    public string? Note { get; init; }
    public string GeneratedBy { get; init; } = "";
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;

    public bool IncludeVolunteers { get; init; } = true;
    public bool IncludeIndicators { get; init; } = true;
    public bool IncludeUpdates { get; init; } = true;
    public bool IncludePhotos { get; init; } = true;
    public bool IncludeTasks { get; init; } = true;

    /// <summary>Resumo: so os Resultados e a tabela dos projetos, sem o capitulo de cada projeto.</summary>
    public bool Summary { get; init; }

    /// <summary>Periodo de referencia; vazio nas duas pontas, o relatorio cobre todo o historico.</summary>
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }

    public bool HasPeriod => From.HasValue || To.HasValue;

    /// <summary>Data (no horario de Brasilia, o mesmo em que o PDF mostra as datas) dentro do periodo de referencia.</summary>
    public bool InPeriod(DateTime value) => InPeriod(TextHelpers.BrasiliaDay(value));

    /// <summary>Dia dentro do periodo de referencia (registros de andamento contam pelo dia em que aconteceram).</summary>
    public bool InPeriod(DateOnly day) => InPeriod(day, From, To);

    /// <summary>A mesma regra do PDF, para quem conta antes de gerar (tela Relatorios).</summary>
    public static bool InPeriod(DateOnly day, DateOnly? from, DateOnly? to) =>
        (from is null || day >= from) && (to is null || day <= to);

    /// <summary>Fotos ja lidas do disco, por atualizacao (ProjectUpdate.Id) - limitadas pelo servico.</summary>
    public Dictionary<Guid, List<ReportPhoto>> Photos { get; init; } = new();

    /// <summary>Horas lancadas por projeto e por pessoa (no periodo de referencia, quando houver).</summary>
    public Dictionary<Guid, Dictionary<Guid, decimal>> Hours { get; init; } = new();

    public decimal HoursOf(Guid projectId) => Hours.TryGetValue(projectId, out var people) ? people.Values.Sum() : 0;

    /// <summary>Indicadores padrao de cada programa somados nos projetos do relatorio (bloco Resultados).</summary>
    public List<ReportProgramResults> ProgramResults { get; init; } = new();

    /// <summary>Numero de cada indicador (Indicator.Id) no relatorio, lido do historico: no fim do periodo e no comeco.</summary>
    public Dictionary<Guid, IndicatorFigure> Figures { get; init; } = new();

    public IndicatorFigure Figure(Indicator indicator) =>
        Figures.TryGetValue(indicator.Id, out var figure)
            ? figure
            : new IndicatorFigure(indicator.Value, indicator.ValueUpdatedAt, null);

    /// <summary>Dia dos valores dos indicadores: o fim do periodo, ou hoje quando o periodo vai ate hoje (ou nao tem fim).</summary>
    public DateOnly AsOf
    {
        get
        {
            var today = TextHelpers.BrasiliaDay(GeneratedAt);
            return To is { } to && to < today ? to : today;
        }
    }

    /// <summary>Com inicio de periodo, os indicadores dizem quanto mudaram dentro dele.</summary>
    public bool ShowsChange => From.HasValue;

    /// <summary>Parceiros de cada programa (ProgramId), na ordem da lista: so nome e papel vao para o PDF.</summary>
    public Dictionary<Guid, List<ReportPartner>> Partners { get; init; } = new();

    /// <summary>"Instituto X (Financiador) · Prefeitura"; null quando o programa nao tem parceiros.</summary>
    public string? PartnersLine(Guid programId) =>
        Partners.TryGetValue(programId, out var list) && list.Count > 0
            ? string.Join(" · ", list.Select(p => string.IsNullOrWhiteSpace(p.Role) ? p.Name : $"{p.Name} ({p.Role})"))
            : null;
}

public record ReportPartner(string Name, string? Role);

public record ReportProgramResults(Guid ProgramId, string Program, int Projects, List<ReportResult> Results);

/// <summary>
/// Resultado somado (so os valores informados); Informed de Projects projetos do relatorio informaram. Change: quanto
/// a soma mudou no periodo (zero sem inicio de periodo).
/// </summary>
public record ReportResult(string Name, string? Unit, decimal Total, int Informed, int Projects, decimal Change);

/// <summary>Caption so vem preenchida quando o arquivo tem uma descricao de verdade cadastrada
/// (nunca cai para o nome do arquivo) - o relatorio so exibe legenda quando ela existir.</summary>
public record ReportPhoto(string? Caption, byte[] Data);
