namespace Esf.Api.Domain.Entities;

/// <summary>Comentario numa atividade: a conversa do dia a dia (nao vai para o relatorio, ao contrario dos relatos).</summary>
public class ActivityComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ActivityId { get; set; }
    public Activity? Activity { get; set; }

    /// <summary>Quem escreveu (vazio se o acesso foi excluido).</summary>
    public Guid? AuthorUserId { get; set; }
    public User? AuthorUser { get; set; }

    public string Text { get; set; } = string.Empty;

    /// <summary>Voluntarios mencionados com @ (recebem aviso no sininho).</summary>
    public List<Guid> MentionedVolunteerIds { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }
}
