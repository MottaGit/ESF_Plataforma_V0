using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

/// <summary>Horas lancadas num projeto: o total, quanto cada pessoa da equipe lancou e os lancamentos (mais novos primeiro).</summary>
public record ProjectHoursDto(decimal Total, List<PersonHoursDto> People, List<ProjectHourEntryDto> Entries);

public record PersonHoursDto(Guid VolunteerId, string Name, decimal Hours);

public record ProjectHourEntryDto(
    Guid Id,
    Guid VolunteerId,
    string VolunteerName,
    string? PhotoUrl,
    DateOnly Date,
    decimal Hours,
    string? Description,
    /// <summary>Quem esta logado pode corrigir ou apagar (o proprio lancamento, ou qualquer um para a coordenacao).</summary>
    bool CanEdit);

public class SaveHourEntryRequest
{
    /// <summary>De quem sao as horas; vazio = de quem esta logado. So a coordenacao lanca para outra pessoa.</summary>
    public Guid? VolunteerId { get; set; }

    [Required(ErrorMessage = "Informe o dia.")]
    public DateOnly? Date { get; set; }

    [Required(ErrorMessage = "Informe as horas.")]
    public decimal? Hours { get; set; }

    [StringLength(300, ErrorMessage = "Descreva o que fez em até 300 caracteres.")]
    public string? Description { get; set; }
}
