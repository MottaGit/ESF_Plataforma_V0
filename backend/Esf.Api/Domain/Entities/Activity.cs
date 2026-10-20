namespace Esf.Api.Domain.Entities;

public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public Guid? AssignedVolunteerId { get; set; }
    public Volunteer? AssignedVolunteer { get; set; }

    public ActivityStatus Status { get; set; } = ActivityStatus.AFazer;
    /// <summary>O que esta travando a atividade; so existe enquanto ela esta bloqueada.</summary>
    public string? BlockedReason { get; set; }
    public ActivityPriority Priority { get; set; } = ActivityPriority.Media;
    public DateOnly? DueDate { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public ICollection<ActivityChecklistItem> ChecklistItems { get; set; } = new List<ActivityChecklistItem>();

    /// <summary>Arquivos anexados na atividade (tambem aparecem na aba Arquivos do projeto).</summary>
    public ICollection<ProjectFile> Attachments { get; set; } = new List<ProjectFile>();

    public ICollection<ActivityComment> Comments { get; set; } = new List<ActivityComment>();
}
