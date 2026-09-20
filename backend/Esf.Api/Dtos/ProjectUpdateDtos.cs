using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Esf.Api.Dtos;

public record ProjectUpdateDto(
    Guid Id,
    Guid ProjectId,
    string Text,
    Guid? AuthorUserId,
    string? AuthorName,
    DateTime CreatedAt,
    DateTime? EditedAt,
    List<ProjectFileDto> Attachments);

public class SaveProjectUpdateRequest
{
    [Required(ErrorMessage = "Escreva o relato da atualizacao.")]
    public string Text { get; set; } = string.Empty;
}

/// <summary>Texto + arquivos num unico objeto multipart (evita ambiguidade de binding com [FromForm]).</summary>
public class CreateProjectUpdateRequest
{
    [Required(ErrorMessage = "Escreva o relato da atualizacao.")]
    public string Text { get; set; } = string.Empty;

    public List<IFormFile> Files { get; set; } = new();
}
