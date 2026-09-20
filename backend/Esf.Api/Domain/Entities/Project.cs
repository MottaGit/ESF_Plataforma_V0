namespace Esf.Api.Domain.Entities;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;

    /// <summary>Responsavel pelo projeto (usuario da plataforma).</summary>
    public Guid? OwnerUserId { get; set; }
    public User? OwnerUser { get; set; }

    public string? Objective { get; set; }
    /// <summary>Comunidade ou beneficiarios atendidos.</summary>
    public string? Beneficiaries { get; set; }
    /// <summary>Publico beneficiado (ex.: 12 familias em situacao de vulnerabilidade).</summary>
    public string? TargetAudience { get; set; }
    public string? Notes { get; set; }

    public string? Address { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly? EndDateForecast { get; set; }

    public ProjectStatus Status { get; set; } = ProjectStatus.Planejamento;
    public int Progress { get; set; }

    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
    public ICollection<Indicator> Indicators { get; set; } = new List<Indicator>();
    public ICollection<ProjectFile> Files { get; set; } = new List<ProjectFile>();
    public ICollection<ProjectVolunteer> Volunteers { get; set; } = new List<ProjectVolunteer>();
    public ICollection<ProjectUpdate> Updates { get; set; } = new List<ProjectUpdate>();
}
