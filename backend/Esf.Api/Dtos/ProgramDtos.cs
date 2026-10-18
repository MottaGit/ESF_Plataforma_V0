using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

// ProjectsCount: quantos projetos (inclusive arquivados) pertencem ao programa.
public record ProgramDto(Guid Id, string Name, ProgramStatus Status, DateTime CreatedAt, int ProjectsCount);

public class SaveProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;
}

public class UpdateProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecione a situacao do programa.")]
    public ProgramStatus? Status { get; set; }
}
