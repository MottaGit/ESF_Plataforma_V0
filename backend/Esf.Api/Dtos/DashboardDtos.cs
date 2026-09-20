using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record DashboardDto(
    ProjectTotalsDto Totals,
    IReadOnlyList<StatusCountDto> ByStatus,
    IReadOnlyList<CategoryCountDto> ByCategory,
    IReadOnlyList<IndicatorSummaryDto> TopIndicators,
    IReadOnlyList<ProjectListItemDto> ActiveProjects,
    IReadOnlyList<ActivityDto> UpcomingActivities);

public record ProjectTotalsDto(
    int Projects,
    int InProgress,
    int Planning,
    int Completed,
    int Late,
    int PendingActivities,
    int Volunteers);

public record StatusCountDto(ProjectStatus Status, int Count);

public record CategoryCountDto(string Category, int Count);

/// <summary>Indicador consolidado pelo nome, somando todos os projetos.</summary>
public record IndicatorSummaryDto(string Name, string? Unit, decimal Value);
