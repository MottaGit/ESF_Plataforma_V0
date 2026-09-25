namespace Esf.Api.Domain.Entities;

public class Volunteer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    /// <summary>Setor interno da organizacao ao qual o voluntario pertence.</summary>
    public VolunteerSector Sector { get; set; }
    /// <summary>Competencias e habilidades do voluntario.</summary>
    public string? Skills { get; set; }
    public string? Notes { get; set; }
    public VolunteerStatus Status { get; set; } = VolunteerStatus.Ativo;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectVolunteer> Projects { get; set; } = new List<ProjectVolunteer>();
}
