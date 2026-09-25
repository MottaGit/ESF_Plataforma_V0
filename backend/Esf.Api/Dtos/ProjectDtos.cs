using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record ProjectListItemDto(
    Guid Id,
    string Name,
    Guid ProgramId,
    string ProgramName,
    ProjectStatus Status,
    int Progress,
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
    DateTime UpdatedAt);

public record ProjectDetailDto(
    Guid Id,
    string Name,
    string? Description,
    Guid ProgramId,
    string ProgramName,
    ProjectStatus Status,
    int Progress,
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
    IReadOnlyList<ProjectUpdateDto> Updates);

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

    [Range(0, 100, ErrorMessage = "O progresso deve estar entre 0 e 100.")]
    public int Progress { get; set; }
}

public class UpdateProjectStatusRequest
{
    [Required(ErrorMessage = "Selecione o status.")]
    public ProjectStatus? Status { get; set; }
}

public class UpdateProjectProgressRequest
{
    [Range(0, 100, ErrorMessage = "O progresso deve estar entre 0 e 100.")]
    public int Progress { get; set; }
}

/// <summary>Filtros da listagem de projetos.</summary>
public class ProjectQuery
{
    public string? Search { get; set; }
    public ProjectStatus? Status { get; set; }
    public Guid? ProgramId { get; set; }
    public Guid? OwnerVolunteerId { get; set; }
    public bool OnlyLate { get; set; }
    public bool IncludeArchived { get; set; }
    /// <summary>recent | name | status | deadline | progress</summary>
    public string? Sort { get; set; }
}
