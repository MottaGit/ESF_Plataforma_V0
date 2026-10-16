using Esf.Api.Domain.Entities;

namespace Esf.Api.Reports;

public class ReportModel
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

    /// <summary>Fotos ja lidas do disco, por atualizacao (ProjectUpdate.Id) - limitadas pelo servico.</summary>
    public Dictionary<Guid, List<ReportPhoto>> Photos { get; init; } = new();
}

/// <summary>Caption so vem preenchida quando o arquivo tem uma descricao de verdade cadastrada
/// (nunca cai para o nome do arquivo) - o relatorio so exibe legenda quando ela existir.</summary>
public record ReportPhoto(string? Caption, byte[] Data);
