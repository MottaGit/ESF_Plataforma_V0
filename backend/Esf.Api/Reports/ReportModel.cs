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

    /// <summary>Data (no fuso em que o PDF mostra as datas) dentro do periodo de referencia.</summary>
    public bool InPeriod(DateTime value)
    {
        var day = DateOnly.FromDateTime(value.ToLocalTime());
        return (From is null || day >= From) && (To is null || day <= To);
    }

    /// <summary>Fotos ja lidas do disco, por atualizacao (ProjectUpdate.Id) - limitadas pelo servico.</summary>
    public Dictionary<Guid, List<ReportPhoto>> Photos { get; init; } = new();
}

/// <summary>Caption so vem preenchida quando o arquivo tem uma descricao de verdade cadastrada
/// (nunca cai para o nome do arquivo) - o relatorio so exibe legenda quando ela existir.</summary>
public record ReportPhoto(string? Caption, byte[] Data);
