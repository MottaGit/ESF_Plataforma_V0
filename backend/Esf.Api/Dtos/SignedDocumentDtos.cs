using Esf.Api.Domain;
using Microsoft.AspNetCore.Http;

namespace Esf.Api.Dtos;

public record SignedDocumentDto(
    Guid Id,
    SignedDocumentKind Kind,
    string FileName,
    long SizeBytes,
    DateOnly SignedOn,
    DateTime UploadedAt,
    string? UploadedByName);

/// <summary>Arquivo assinado + data da assinatura num unico objeto multipart.</summary>
public class UploadSignedDocumentRequest
{
    public IFormFile? File { get; set; }

    /// <summary>Data em que foi assinado; sem ela, vale a data de hoje.</summary>
    public DateOnly? SignedOn { get; set; }
}
