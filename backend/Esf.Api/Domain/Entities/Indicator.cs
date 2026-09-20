namespace Esf.Api.Domain.Entities;

public class Indicator
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public decimal Value { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
