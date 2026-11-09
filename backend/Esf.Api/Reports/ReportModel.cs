using Esf.Api.Common;
using Esf.Api.Domain.Entities;

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

    /// <summary>Periodo de referencia; vazio nas duas pontas, o relatorio cobre todo o historico.</summary>
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }

    public bool HasPeriod => From.HasValue || To.HasValue;

    /// <summary>Data (no horario de Brasilia, o mesmo em que o PDF mostra as datas) dentro do periodo de referencia.</summary>
    public bool InPeriod(DateTime value) => InPeriod(TextHelpers.BrasiliaDay(value));

    /// <summary>Dia dentro do periodo de referencia (registros de andamento contam pelo dia em que aconteceram).</summary>
    public bool InPeriod(DateOnly day) => (From is null || day >= From) && (To is null || day <= To);

    /// <summary>Fotos ja lidas do disco, por atualizacao (ProjectUpdate.Id) - limitadas pelo servico.</summary>
    public Dictionary<Guid, List<ReportPhoto>> Photos { get; init; } = new();

    /// <summary>Horas lancadas por projeto e por pessoa (no periodo de referencia, quando houver).</summary>
    public Dictionary<Guid, Dictionary<Guid, decimal>> Hours { get; init; } = new();

    public decimal HoursOf(Guid projectId) => Hours.TryGetValue(projectId, out var people) ? people.Values.Sum() : 0;

    /// <summary>Indicadores padrao de cada programa somados nos projetos do relatorio (bloco Resultados).</summary>
    public List<ReportProgramResults> ProgramResults { get; init; } = new();
}

public record ReportProgramResults(string Program, int Projects, List<ReportResult> Results);

/// <summary>Resultado somado (so os valores informados); Informed de Projects projetos do relatorio informaram.</summary>
public record ReportResult(string Name, string? Unit, decimal Total, int Informed, int Projects);

/// <summary>Caption so vem preenchida quando o arquivo tem uma descricao de verdade cadastrada
/// (nunca cai para o nome do arquivo) - o relatorio so exibe legenda quando ela existir.</summary>
public record ReportPhoto(string? Caption, byte[] Data);
