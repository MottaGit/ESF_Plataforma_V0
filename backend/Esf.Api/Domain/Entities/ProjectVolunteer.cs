namespace Esf.Api.Domain.Entities;

/// <summary>Vinculo entre projeto e voluntario (N:N com dados do vinculo).</summary>
public class ProjectVolunteer
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public Guid VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    /// <summary>Papel do voluntario neste projeto especifico.</summary>
    public string? RoleInProject { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
