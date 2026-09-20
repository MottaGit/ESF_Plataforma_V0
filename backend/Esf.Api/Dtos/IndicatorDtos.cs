using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public record IndicatorDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Unit,
    decimal Value,
    DateTime CreatedAt);

public class SaveIndicatorRequest
{
    [Required(ErrorMessage = "Informe o nome do indicador.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(60)]
    public string? Unit { get; set; }

    [Required(ErrorMessage = "Informe o valor.")]
    [Range(0, 999999999, ErrorMessage = "Valor invalido.")]
    public decimal? Value { get; set; }
}
