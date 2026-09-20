namespace Esf.Api.Domain.Entities;

/// <summary>Relato de andamento do projeto: o que foi feito, decisoes tomadas, com data e autor.</summary>
public class ProjectUpdate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public string Text { get; set; } = string.Empty;

    public Guid? AuthorUserId { get; set; }
    public User? AuthorUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    public ICollection<ProjectFile> Attachments { get; set; } = new List<ProjectFile>();
}
