using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record ProgramDto(
    Guid Id,
    string Name,
    ProgramStatus Status,
    DateTime CreatedAt,
    // Quantos projetos (inclusive arquivados) pertencem ao programa.
    int ProjectsCount,
    // Em planejamento ou em andamento (sem os arquivados) e concluidos.
    int ActiveProjectsCount,
    int DoneProjectsCount,
    string Icon,
    string Color);

public class SaveProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Chave do icone (ver ProgramAppearance); vazio usa o padrao.</summary>
    public string? Icon { get; set; }

    /// <summary>Chave da cor (ver ProgramAppearance); vazio usa o padrao.</summary>
    public string? Color { get; set; }
}

public class UpdateProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecione a situacao do programa.")]
    public ProgramStatus? Status { get; set; }

    public string? Icon { get; set; }
    public string? Color { get; set; }
}
