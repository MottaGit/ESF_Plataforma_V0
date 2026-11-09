namespace Esf.Api.Domain.Entities;

public class Indicator
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    /// <summary>
    /// Indicador nacional (nome e unidade vem dele): todo projeto tem os nacionais ativos, e eles nao saem do projeto.
    /// Vazio: indicador especifico do projeto.
    /// </summary>
    public Guid? NationalIndicatorId { get; set; }
    public NationalIndicator? NationalIndicator { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }

    /// <summary>Vazio: ainda nao informado (diferente de zero). As somas ignoram os vazios.</summary>
    public decimal? Value { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Quando o valor mudou pela ultima vez (para saber se o numero ainda vale). Vazio: nunca informado, ou informado
    /// antes deste campo existir.
    /// </summary>
    public DateTime? ValueUpdatedAt { get; set; }
}
