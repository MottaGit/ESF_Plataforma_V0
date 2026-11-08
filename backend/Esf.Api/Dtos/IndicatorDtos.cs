using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public record IndicatorDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Unit,
    // Vazio: ainda nao informado.
    decimal? Value,
    DateTime CreatedAt,
    // Indicador nacional escolhido (null: especifico do projeto).
    Guid? NationalIndicatorId);

public class SaveIndicatorRequest
{
    [Required(ErrorMessage = "Informe o nome do indicador.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(60)]
    public string? Unit { get; set; }

    /// <summary>Vazio: ainda nao informado (nao entra nas somas como zero).</summary>
    [Range(0, 999999999, ErrorMessage = "Valor inválido.")]
    public decimal? Value { get; set; }

    /// <summary>Indicador nacional escolhido: nome e unidade passam a vir dele (o que vier em Name e Unit e ignorado).</summary>
    public Guid? NationalIndicatorId { get; set; }
}
