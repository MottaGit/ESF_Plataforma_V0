namespace Esf.Api.Domain.Entities;

/// <summary>
/// Historico de status do voluntario: a partir de StartsOn, a situacao passou a ser Status (ate a linha seguinte).
/// Status vazio marca um intervalo sem registro (ex.: entre um periodo antigo e a volta da pessoa).
/// As horas de voluntariado contam so os dias como Ativo.
/// </summary>
public class VolunteerStatusChange
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    public VolunteerStatus? Status { get; set; }
    public DateOnly StartsOn { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
