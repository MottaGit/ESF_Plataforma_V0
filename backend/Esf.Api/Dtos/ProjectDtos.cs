using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;
using Esf.Api.Services;

namespace Esf.Api.Dtos;

public record ProjectListItemDto(
    Guid Id,
    string Name,
    Guid ProgramId,
    string ProgramName,
    ProjectStatus Status,
    Guid? OwnerVolunteerId,
    string? OwnerName,
    string? District,
    string? City,
    DateOnly StartDate,
    DateOnly? EndDateForecast,
    bool IsLate,
    bool IsArchived,
    int ActivitiesTotal,
    int ActivitiesDone,
    int VolunteersCount,
    DateTime UpdatedAt,
    // Data da atualizacao de andamento mais recente (null se o projeto nunca teve uma).
    DateTime? LastUpdateAt,
    // Data da autorizacao de uso de imagem dos beneficiarios mais recente (null: nao registrada).
    DateOnly? ImageAuthorizedOn,
    // Icone e cor do programa (cards e pinos do mapa).
    string ProgramIcon,
    string ProgramColor,
    // Ponto do projeto no mapa (vazio: ainda nao marcado).
    double? Latitude,
    double? Longitude)
{
    /// <summary>Calculado a partir das atividades (ver Mapping.ProjectProgress).</summary>
    public int Progress => Mapping.ProjectProgress(Status, ActivitiesTotal, ActivitiesDone);
}

public record ProjectDetailDto(
    Guid Id,
    string Name,
    string? Description,
    Guid ProgramId,
    string ProgramName,
    ProjectStatus Status,
    Guid? OwnerVolunteerId,
    string? OwnerName,
    string? Objective,
    string? Beneficiaries,
    string? TargetAudience,
    string? Notes,
    string? Address,
    string? District,
    string? City,
    string? State,
    double? Latitude,
    double? Longitude,
    DateOnly StartDate,
    DateOnly? EndDateForecast,
    bool IsLate,
    bool IsArchived,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<ActivityDto> Activities,
    IReadOnlyList<ProjectVolunteerDto> Volunteers,
    IReadOnlyList<IndicatorDto> Indicators,
    IReadOnlyList<ProjectFileDto> Files,
    IReadOnlyList<ProjectUpdateDto> Updates,
    // Data da autorizacao de uso de imagem dos beneficiarios mais recente (null: nao registrada).
    DateOnly? ImageAuthorizedOn,
    string ProgramIcon,
    string ProgramColor)
{
    /// <summary>Calculado a partir das atividades (ver Mapping.ProjectProgress).</summary>
    public int Progress => Mapping.ProjectProgress(
        Status, Activities.Count, Activities.Count(a => a.Status == ActivityStatus.Concluida));
}

public class SaveProjectRequest
{
    [Required(ErrorMessage = "Informe o nome do projeto.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required(ErrorMessage = "Selecione o programa.")]
    public Guid? ProgramId { get; set; }

    public Guid? OwnerVolunteerId { get; set; }

    public string? Objective { get; set; }

    [StringLength(300)]
    public string? Beneficiaries { get; set; }

    [StringLength(300)]
    public string? TargetAudience { get; set; }

    public string? Notes { get; set; }

    [StringLength(300)]
    public string? Address { get; set; }

    [StringLength(120)]
    public string? District { get; set; }

    [StringLength(120)]
    public string? City { get; set; }

    [StringLength(60)]
    public string? State { get; set; }

    [Range(-90, 90, ErrorMessage = "Latitude deve estar entre -90 e 90.")]
    public double? Latitude { get; set; }

    [Range(-180, 180, ErrorMessage = "Longitude deve estar entre -180 e 180.")]
    public double? Longitude { get; set; }

    [Required(ErrorMessage = "Informe a data de inicio.")]
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDateForecast { get; set; }

    [Required(ErrorMessage = "Selecione o status.")]
    public ProjectStatus? Status { get; set; }

    /// <summary>
    /// So na criacao: usa o modelo do programa (cria as atividades e os indicadores padrao e preenche descricao,
    /// objetivo e publico que vierem vazios).
    /// </summary>
    public bool UseTemplate { get; set; }
}

public class UpdateProjectStatusRequest
{
    [Required(ErrorMessage = "Selecione o status.")]
    public ProjectStatus? Status { get; set; }
}

/// <summary>Filtros da listagem de projetos.</summary>
public class ProjectQuery
{
    public string? Search { get; set; }
    public ProjectStatus? Status { get; set; }
    public Guid? ProgramId { get; set; }
    public Guid? OwnerVolunteerId { get; set; }
    public bool OnlyLate { get; set; }
    /// <summary>So os parados: em andamento e sem relato ha mais de 30 dias.</summary>
    public bool OnlyStale { get; set; }
    public bool IncludeArchived { get; set; }
    /// <summary>recent | name | status | deadline | progress</summary>
    public string? Sort { get; set; }
}
