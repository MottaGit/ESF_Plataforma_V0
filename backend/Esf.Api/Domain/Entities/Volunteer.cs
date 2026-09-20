namespace Esf.Api.Domain.Entities;

public class Volunteer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    /// <summary>Setor interno da organizacao ao qual o voluntario pertence.</summary>
    public VolunteerSector Sector { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectVolunteer> Projects { get; set; } = new List<ProjectVolunteer>();
}
