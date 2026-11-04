using Esf.Api.Domain;
using Esf.Api.Reports;
using Microsoft.AspNetCore.Http;

namespace Esf.Api.Dtos;

public record SignedDocumentDto(
    Guid Id,
    SignedDocumentKind Kind,
    string FileName,
    long SizeBytes,
    DateOnly SignedOn,
    DateTime UploadedAt,
    string? UploadedByName,
    /// <summary>Assinado online pelo proprio voluntario (sem arquivo enviado).</summary>
    bool SignedOnline,
    /// <summary>Momento da assinatura online (UTC).</summary>
    DateTime? SignedAt,
    bool? ImageAuthorized);

/// <summary>Arquivo assinado + data da assinatura num unico objeto multipart.</summary>
public class UploadSignedDocumentRequest
{
    public IFormFile? File { get; set; }

    /// <summary>Data em que foi assinado; sem ela, vale a data de hoje.</summary>
    public DateOnly? SignedOn { get; set; }
}

/// <summary>Termo de adesao do proprio voluntario: o texto para ler e, se ja assinou, quando.</summary>
public record MyTermDto(
    string VolunteerName,
    string? Email,
    string? Phone,
    /// <summary>Precisa assinar: ativo ou afastado e sem termo.</summary>
    bool Pending,
    MyTermSignedDto? Signed,
    VolunteerTermText Text);

/// <summary>A via mais recente do termo: data e, quando foi assinada online, o momento e a resposta sobre imagem.</summary>
public record MyTermSignedDto(DateOnly SignedOn, DateTime? SignedAt, bool SignedOnline, bool? ImageAuthorized);

public class SignTermRequest
{
    /// <summary>Nome completo digitado, igual ao do cadastro (sem diferenca de acento ou maiuscula).</summary>
    public string? FullName { get; set; }

    public string? Cpf { get; set; }

    /// <summary>Resposta da clausula de uso de imagem (obrigatoria).</summary>
    public bool? ImageAuthorized { get; set; }

    /// <summary>"Li e concordo com o termo".</summary>
    public bool Accepted { get; set; }
}
