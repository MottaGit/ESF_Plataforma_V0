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
    List<ProjectFileDto> Attachments,
    // Foto do voluntario vinculado ao autor (null sem vinculo ou sem foto).
    string? AuthorPhotoUrl,
    // Dia em que aconteceu (nos registros antigos, o da publicacao).
    DateOnly HappenedOn);

public class SaveProjectUpdateRequest
{
    [Required(ErrorMessage = "Escreva o registro de andamento.")]
    public string Text { get; set; } = string.Empty;

    /// <summary>Dia em que aconteceu (vazio: mantem o que esta).</summary>
    public DateOnly? HappenedOn { get; set; }
}

/// <summary>Texto + arquivos num unico objeto multipart (evita ambiguidade de binding com [FromForm]).</summary>
public class CreateProjectUpdateRequest
{
    [Required(ErrorMessage = "Escreva o registro de andamento.")]
    public string Text { get; set; } = string.Empty;

    public List<IFormFile> Files { get; set; } = new();

    /// <summary>Horas que quem registra dedicou ao projeto nesse dia (opcional): viram um lancamento de horas.</summary>
    public decimal? Hours { get; set; }

    /// <summary>Dia em que aconteceu o que o registro conta (vazio: hoje). Nao pode ser depois de hoje.</summary>
    public DateOnly? HappenedOn { get; set; }
}
