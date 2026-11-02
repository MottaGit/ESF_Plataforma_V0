namespace Esf.Api.Domain.Entities;

public class Indicator
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>Indicador nacional escolhido (nome e unidade vem dele); vazio: indicador especifico do projeto.</summary>
    public Guid? NationalIndicatorId { get; set; }
    public NationalIndicator? NationalIndicator { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal Value { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
