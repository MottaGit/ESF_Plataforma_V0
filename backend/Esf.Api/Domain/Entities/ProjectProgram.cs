using Esf.Api.Common;

namespace Esf.Api.Domain.Entities;

/// <summary>
/// Programa: agrupamento de projetos (ex.: "Banheiro Direito da Gente", "Horta comunitaria").
/// Nomeado ProjectProgram (nao "Program") para nao colidir com a classe Program gerada
/// pelos top-level statements de Program.cs.
/// </summary>
public class ProjectProgram
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public ProgramStatus Status { get; set; } = ProgramStatus.Ativo;

    /// <summary>Icone do programa (chave de ProgramAppearance.Icons), usado nos cards e nos pinos do mapa.</summary>
    public string Icon { get; set; } = ProgramAppearance.DefaultIcon;

    /// <summary>Cor do programa (chave de ProgramAppearance.Colors), usada nos cards e nos pinos do mapa.</summary>
    public string Color { get; set; } = ProgramAppearance.DefaultColor;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ---------- modelo: o que um projeto novo do programa ja recebe ----------

    /// <summary>Textos sugeridos: preenchem descricao, objetivo e publico do projeto novo quando vierem vazios.</summary>
    public string? TemplateDescription { get; set; }
    public string? TemplateObjective { get; set; }
    public string? TemplateTargetAudience { get; set; }

    public ICollection<ProgramTemplateActivity> TemplateActivities { get; set; } = new List<ProgramTemplateActivity>();
    public ICollection<ProgramTemplateIndicator> TemplateIndicators { get; set; } = new List<ProgramTemplateIndicator>();

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
