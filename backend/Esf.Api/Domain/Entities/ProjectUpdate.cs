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

    /// <summary>
    /// Dia em que aconteceu o que o registro conta (o mutirao de sabado registrado na segunda). Vazio nos registros
    /// de antes deste campo: vale o dia em que foram publicados (ver Day).
    /// </summary>
    public DateOnly? HappenedOn { get; set; }

    /// <summary>Dia do registro para ordenar, mostrar e filtrar por periodo (relatorio): o que aconteceu, ou o da publicacao.</summary>
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public DateOnly Day => HappenedOn ?? Common.TextHelpers.BrasiliaDay(CreatedAt);

    public ICollection<ProjectFile> Attachments { get; set; } = new List<ProjectFile>();
}
