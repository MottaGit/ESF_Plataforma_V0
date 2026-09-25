using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record ProgramDto(Guid Id, string Name, ProgramStatus Status, DateTime CreatedAt);

public class SaveProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;
}
