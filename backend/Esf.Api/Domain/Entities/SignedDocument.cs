namespace Esf.Api.Domain.Entities;

/// <summary>
/// Documento assinado: o termo de adesao de um voluntario (enviado pela coordenacao ou assinado online pelo proprio
/// voluntario) ou a autorizacao de uso de imagem dos beneficiarios de um projeto. O arquivo fica em StoredFiles como
/// privado.
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

    // ---------- assinatura online (vazios quando o arquivo foi enviado) ----------

    /// <summary>Nome completo digitado pelo voluntario ao assinar online.</summary>
    public string? SignerName { get; set; }

    /// <summary>Momento exato da assinatura online (UTC).</summary>
    public DateTime? SignedAt { get; set; }

    /// <summary>Endereco de rede de quem assinou (com os repassados pelo proxy, quando houver).</summary>
    public string? SignerIp { get; set; }

    public string? SignerUserAgent { get; set; }

    /// <summary>Versao do texto do termo que foi assinada (<see cref="Reports.DocumentTemplates.VolunteerTermVersion"/>).</summary>
    public string? TermVersion { get; set; }

    /// <summary>SHA-256 do PDF gerado na assinatura: mostra que o arquivo guardado nao mudou depois.</summary>
    public string? ContentHash { get; set; }

    /// <summary>Resposta da clausula de uso de imagem na assinatura online.</summary>
    public bool? ImageAuthorized { get; set; }
}
