using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public record ProjectFileDto(
    Guid Id,
    Guid ProjectId,
    string FileName,
    string ContentType,
    long SizeBytes,
    string? Description,
    string Url,
    bool IsImage,
    string? UploadedByName,
    DateTime UploadedAt,
    // Preenchidos quando o arquivo foi anexado a uma atualizacao de andamento.
    Guid? ProjectUpdateId,
    DateTime? UpdateCreatedAt,
    // Preenchidos quando o arquivo foi anexado numa atividade.
    Guid? ActivityId,
    string? ActivityTitle,
    // Miniatura da foto (listas e galeria); null enquanto nao foi gerada, ou quando nao e foto: use a Url.
    string? ThumbnailUrl);

public class SaveFileDescriptionRequest
{
    /// <summary>Legenda do arquivo (vazia remove a legenda).</summary>
    [StringLength(300, ErrorMessage = "A legenda deve ter no máximo 300 caracteres.")]
    public string? Description { get; set; }
}
