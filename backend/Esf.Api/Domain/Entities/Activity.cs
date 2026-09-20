namespace Esf.Api.Domain.Entities;

public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public Guid? AssignedUserId { get; set; }
    public User? AssignedUser { get; set; }

    public ActivityStatus Status { get; set; } = ActivityStatus.AFazer;
    public ActivityPriority Priority { get; set; } = ActivityPriority.Media;
    public DateOnly? DueDate { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
