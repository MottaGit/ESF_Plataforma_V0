namespace Esf.Api.Domain.Entities;

/// <summary>
/// Indicador nacional: definido pela gestao nacional (nome, unidade e como contar) e escolhido pelos nucleos nos
/// indicadores dos projetos e dos modelos de programa. O painel nacional soma os valores pelo vinculo, em todos os
/// nucleos. Nao pertence a nenhum nucleo.
/// </summary>
public class NationalIndicator
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }

    /// <summary>Como contar: a regra comum que faz a soma entre nucleos valer.</summary>
    public string? Description { get; set; }

    /// <summary>Arquivado: sai das opcoes para indicadores novos; os ja ligados continuam.</summary>
    public bool IsArchived { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
