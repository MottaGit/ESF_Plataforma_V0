namespace Esf.Api.Domain.Entities;

/// <summary>Atividade padrao do modelo de um programa: vira uma atividade (sem responsavel) em cada projeto novo.</summary>
public class ProgramTemplateActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProgramId { get; set; }
    public ProjectProgram? Program { get; set; }

    /// <summary>Ordem no modelo (e na criacao das atividades).</summary>
    public int Position { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ActivityPriority Priority { get; set; } = ActivityPriority.Media;

    /// <summary>Prazo em dias depois do inicio do projeto; vazio: sem prazo.</summary>
    public int? DueDays { get; set; }
}

/// <summary>Indicador padrao do modelo de um programa: entra zerado em cada projeto novo.</summary>
public class ProgramTemplateIndicator
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProgramId { get; set; }
    public ProjectProgram? Program { get; set; }

    public int Position { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
}
