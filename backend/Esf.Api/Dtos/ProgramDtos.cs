using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record ProgramDto(
    Guid Id,
    string Name,
    ProgramStatus Status,
    DateTime CreatedAt,
    // Quantos projetos (inclusive arquivados) pertencem ao programa.
    int ProjectsCount,
    // Ativos (em planejamento, em andamento ou pausados, sem os arquivados) e concluidos (inclusive arquivados).
    int ActiveProjectsCount,
    int DoneProjectsCount,
    string Icon,
    string Color,
    // "Sobre o programa": texto para quem nao conhece o nucleo (vai para o topo da pagina publica).
    string? About,
    // Resumo do modelo (atividades e indicadores padrao; textos sugeridos preenchidos).
    int TemplateActivitiesCount,
    int TemplateIndicatorsCount,
    bool HasTemplateTexts,
    // A pagina publica do programa esta ligada.
    bool PublicPage,
    // Resultados do programa: nacionais e indicadores padrao do modelo, somados como em ResultTotals.
    List<ProgramResultDto> Results);

/// <summary>Resultado somado: Total null quando nenhum projeto informou; Informed de Projects projetos informaram.</summary>
public record ProgramResultDto(string Name, string? Unit, decimal? Total, int Informed, int Projects, bool National);

/// <summary>
/// Pagina publica do programa, como a coordenacao configura (o codigo so aparece com ela ligada). O texto do topo e o
/// "Sobre o programa", editado junto com o nome (UpdateProgramRequest.About).
/// </summary>
public record ProgramPublicPageDto(bool Enabled, string? Token);

public class SaveProgramPublicPageRequest
{
    public bool Enabled { get; set; }
}

/// <summary>
/// Pagina publica do programa (sem login). So o que pode ser visto por qualquer pessoa: nada de endereco, pessoas,
/// tarefas, registros, fotos ou arquivos.
/// </summary>
public record PublicProgramDto(
    string Name,
    string Icon,
    string Color,
    string? About,
    PublicNucleoDto Nucleo,
    PublicProgramTotalsDto Totals,
    // Indicadores somados nos projetos mostrados (nacionais e os do modelo do programa); so os que tem valor.
    List<PublicIndicatorDto> Results,
    List<PublicProjectDto> Projects,
    // Ultimo registro de andamento entre os projetos mostrados.
    DateTime? UpdatedAt);

public record PublicNucleoDto(string Name, string? LogoUrl, string? Cnpj, string? Email, string? City, string? State);

public record PublicProgramTotalsDto(int Concluded, int InProgress, int Planning, int Paused, int Volunteers, decimal Hours);

public record PublicIndicatorDto(string Name, string? Unit, decimal Value, bool National);

public record PublicProjectDto(
    string Name,
    ProjectStatus Status,
    string? District,
    string? City,
    string? State,
    DateOnly StartDate,
    DateOnly? EndDateForecast,
    // Null: projeto em aberto sem nenhuma tarefa (sem barra, em vez de 0%).
    int? Progress,
    List<PublicIndicatorDto> Indicators,
    DateTime? LastUpdateAt,
    // Concluido: o dia em que terminou (null nos encerrados antes de o campo existir).
    DateOnly? ClosedOn);

public record TemplateActivityDto(Guid Id, string Title, string? Description, ActivityPriority Priority, int? DueDays);

public record TemplateIndicatorDto(Guid Id, string Name, string? Unit, Guid? NationalIndicatorId);

/// <summary>Modelo do programa: o que um projeto novo dele ja recebe.</summary>
public record ProgramTemplateDto(
    string? Description,
    string? Objective,
    string? TargetAudience,
    List<TemplateActivityDto> Activities,
    List<TemplateIndicatorDto> Indicators);

/// <summary>
/// O modelo inteiro de uma vez (a tela manda a lista como ficou). Itens com Id sao atualizados, sem Id sao
/// criados e os que nao vierem sao apagados; a ordem da lista e a ordem do modelo.
/// </summary>
public class SaveProgramTemplateRequest
{
    public string? Description { get; set; }
    public string? Objective { get; set; }

    [StringLength(300, ErrorMessage = "O público sugerido deve ter no máximo 300 caracteres.")]
    public string? TargetAudience { get; set; }

    public List<SaveTemplateActivityRequest> Activities { get; set; } = new();
    public List<SaveTemplateIndicatorRequest> Indicators { get; set; } = new();
}

public class SaveTemplateActivityRequest
{
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "Informe o título da tarefa.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O título deve ter entre 3 e 200 caracteres.")]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required(ErrorMessage = "Selecione a prioridade.")]
    public ActivityPriority? Priority { get; set; }

    [Range(0, 3650, ErrorMessage = "O prazo deve ficar entre 0 e 3650 dias.")]
    public int? DueDays { get; set; }
}

public class SaveTemplateIndicatorRequest
{
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "Informe o nome do indicador.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(60, ErrorMessage = "A unidade deve ter no máximo 60 caracteres.")]
    public string? Unit { get; set; }

    /// <summary>Indicador nacional escolhido: nome e unidade passam a vir dele.</summary>
    public Guid? NationalIndicatorId { get; set; }
}

public class SaveProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Chave do icone (ver ProgramAppearance); vazio usa o padrao.</summary>
    public string? Icon { get; set; }

    /// <summary>Chave da cor (ver ProgramAppearance); vazio usa o padrao.</summary>
    public string? Color { get; set; }
}

public class UpdateProgramRequest
{
    [Required(ErrorMessage = "Informe o nome do programa.")]
    [StringLength(120, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 120 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecione a situação do programa.")]
    public ProgramStatus? Status { get; set; }

    public string? Icon { get; set; }
    public string? Color { get; set; }

    /// <summary>"Sobre o programa" (vazio apaga o texto): a tela sempre manda o texto atual.</summary>
    [StringLength(1500, ErrorMessage = "O texto sobre o programa deve ter no máximo 1500 caracteres.")]
    public string? About { get; set; }
}
