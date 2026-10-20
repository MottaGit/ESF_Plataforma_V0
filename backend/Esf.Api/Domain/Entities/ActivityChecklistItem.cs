namespace Esf.Api.Domain.Entities;

/// <summary>Item do checklist de uma atividade (passos menores que nao viram atividade propria).</summary>
public class ActivityChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ActivityId { get; set; }
    public Activity? Activity { get; set; }

    /// <summary>Ordem no checklist (os novos entram no fim).</summary>
    public int Position { get; set; }

    public string Text { get; set; } = string.Empty;
    public bool Done { get; set; }
    public DateTime? DoneAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
