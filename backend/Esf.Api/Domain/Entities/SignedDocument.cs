namespace Esf.Api.Domain.Entities;

/// <summary>
/// Documento assinado e enviado pela coordenacao: o termo de adesao de um voluntario ou a autorizacao de uso
/// de imagem dos beneficiarios de um projeto. O arquivo fica em StoredFiles como privado.
/// </summary>
public class SignedDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public SignedDocumentKind Kind { get; set; }

    public Guid? VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>Nome original enviado.</summary>
    public string FileName { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    /// <summary>Data em que o documento foi assinado (informada por quem enviou).</summary>
    public DateOnly SignedOn { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Guid? UploadedByUserId { get; set; }
}
