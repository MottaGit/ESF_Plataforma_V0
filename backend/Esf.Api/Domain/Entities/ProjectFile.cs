namespace Esf.Api.Domain.Entities;

public class ProjectFile
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>Quando preenchido, o arquivo e um anexo de uma atualizacao, nao da galeria geral do projeto.</summary>
    public Guid? ProjectUpdateId { get; set; }
    public ProjectUpdate? ProjectUpdate { get; set; }

    /// <summary>Nome original enviado pelo usuario.</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Nome fisico no disco (gerado pela aplicacao).</summary>
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Description { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Guid? UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
}
