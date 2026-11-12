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

    /// <summary>Tarefa comum ou visita (a obra, a familia): a visita tem dia (DueDate), turno e duas pessoas.</summary>
    public ActivityKind Kind { get; set; } = ActivityKind.Tarefa;

    /// <summary>Turno da visita (so na visita).</summary>
    public Shift? VisitShift { get; set; }

    /// <summary>Hora combinada da visita, "HH:mm" (opcional, so na visita).</summary>
    public string? VisitTime { get; set; }

    /// <summary>Segunda pessoa da visita (acompanhante); nas tarefas comuns fica vazio.</summary>
    public Guid? CompanionVolunteerId { get; set; }
    public Volunteer? CompanionVolunteer { get; set; }

    public ActivityStatus Status { get; set; } = ActivityStatus.AFazer;
    /// <summary>O que esta travando a atividade; so existe enquanto ela esta bloqueada.</summary>
    public string? BlockedReason { get; set; }
    /// <summary>Alta: a tarefa e urgente (a tela so mostra "Urgente" ou nada); Baixa nao e mais usada.</summary>
    public ActivityPriority Priority { get; set; } = ActivityPriority.Media;
    public DateOnly? DueDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public ICollection<ActivityChecklistItem> ChecklistItems { get; set; } = new List<ActivityChecklistItem>();

    /// <summary>Arquivos anexados na atividade (tambem aparecem na aba Arquivos do projeto).</summary>
    public ICollection<ProjectFile> Attachments { get; set; } = new List<ProjectFile>();

    public ICollection<ActivityComment> Comments { get; set; } = new List<ActivityComment>();
}
