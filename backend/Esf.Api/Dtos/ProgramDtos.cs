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
    // Em planejamento ou em andamento (sem os arquivados) e concluidos.
    int ActiveProjectsCount,
    int DoneProjectsCount,
    string Icon,
    string Color,
    // Resumo do modelo (atividades e indicadores padrao; textos sugeridos preenchidos).
    int TemplateActivitiesCount,
    int TemplateIndicatorsCount,
    bool HasTemplateTexts,
    // Resultados do programa: cada indicador padrao do modelo somado nos projetos (nao arquivados) do programa.
    List<ProgramResultDto> Results);

public record ProgramResultDto(string Name, string? Unit, decimal Total);

public record TemplateActivityDto(Guid Id, string Title, string? Description, ActivityPriority Priority, int? DueDays);

public record TemplateIndicatorDto(Guid Id, string Name, string? Unit);

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

    [StringLength(300, ErrorMessage = "O publico sugerido deve ter no maximo 300 caracteres.")]
    public string? TargetAudience { get; set; }

    public List<SaveTemplateActivityRequest> Activities { get; set; } = new();
    public List<SaveTemplateIndicatorRequest> Indicators { get; set; } = new();
}

public class SaveTemplateActivityRequest
{
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "Informe o titulo da atividade.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O titulo deve ter entre 3 e 200 caracteres.")]
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

    [StringLength(60, ErrorMessage = "A unidade deve ter no maximo 60 caracteres.")]
    public string? Unit { get; set; }
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

    [Required(ErrorMessage = "Selecione a situacao do programa.")]
    public ProgramStatus? Status { get; set; }

    public string? Icon { get; set; }
    public string? Color { get; set; }
}
