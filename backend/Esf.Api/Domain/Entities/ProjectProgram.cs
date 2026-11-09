using Esf.Api.Common;

namespace Esf.Api.Domain.Entities;

/// <summary>
/// Programa: agrupamento de projetos (ex.: "Banheiro Direito da Gente", "Horta comunitaria").
/// Nomeado ProjectProgram (nao "Program") para nao colidir com a classe Program gerada
/// pelos top-level statements de Program.cs.
/// </summary>
public class ProjectProgram : IOrganizationOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Nucleo dono do programa (cada nucleo tem os seus).</summary>
    public Guid OrganizationId { get; set; }

    public string Name { get; set; } = string.Empty;
    public ProgramStatus Status { get; set; } = ProgramStatus.Ativo;

    /// <summary>Icone do programa (chave de ProgramAppearance.Icons), usado nos cards e nos pinos do mapa.</summary>
    public string Icon { get; set; } = ProgramAppearance.DefaultIcon;

    /// <summary>Cor do programa (chave de ProgramAppearance.Colors), usada nos cards e nos pinos do mapa.</summary>
    public string Color { get; set; } = ProgramAppearance.DefaultColor;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ---------- ficha do programa (Editar programa › Sobre): escrita uma vez, usada em dois lugares ----------
    // Aparece na pagina publica e, num projeto novo, descricao e objetivo vazios recebem os do programa.

    /// <summary>O que o programa faz (pagina publica: "O que fazemos"; descricao inicial do projeto novo).</summary>
    public string? Description { get; set; }

    /// <summary>Objetivo do programa (pagina publica; objetivo inicial do projeto novo).</summary>
    public string? Objective { get; set; }

    /// <summary>Para quem e o programa (so na ficha e na pagina publica: o "quem se beneficia" e de cada projeto).</summary>
    public string? Audience { get; set; }

    // ---------- pagina publica (link sem login, so leitura, para parceiros e financiadores) ----------

    /// <summary>Codigo do link publico (/publico/{codigo}); vazio = pagina desligada. Desligar e ligar gera outro.</summary>
    public string? PublicToken { get; set; }

    public ICollection<ProgramTemplateActivity> TemplateActivities { get; set; } = new List<ProgramTemplateActivity>();
    public ICollection<ProgramTemplateIndicator> TemplateIndicators { get; set; } = new List<ProgramTemplateIndicator>();

    /// <summary>Parceiros do programa, na ordem da lista.</summary>
    public ICollection<ProgramPartner> Partners { get; set; } = new List<ProgramPartner>();

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
