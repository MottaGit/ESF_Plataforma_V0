using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

/// <summary>Periodo e carga do certificado de voluntariado. O CPF entra so no PDF: nao e guardado.</summary>
public class CertificateRequest
{
    [Required(ErrorMessage = "Informe o inicio do periodo.")]
    public DateOnly? StartDate { get; set; }

    [Required(ErrorMessage = "Informe o fim do periodo.")]
    public DateOnly? EndDate { get; set; }

    [Range(1, 60, ErrorMessage = "Informe de 1 a 60 horas por semana.")]
    public int WeeklyHours { get; set; } = 6;

    [StringLength(20)]
    public string? Cpf { get; set; }
}
