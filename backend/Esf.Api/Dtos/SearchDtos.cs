using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record SearchProjectDto(Guid Id, string Name, string ProgramName, string ProgramIcon, string ProgramColor,
    ProjectStatus Status, bool IsArchived);

public record SearchProgramDto(Guid Id, string Name, string Icon, string Color, bool IsArchived);

public record SearchActivityDto(Guid Id, string Title, Guid ProjectId, string ProjectName, ActivityStatus Status);

public record SearchVolunteerDto(Guid Id, string Name, VolunteerSector Sector, string? PhotoUrl);

/// <summary>Relato de andamento: trecho do texto em volta do que foi buscado.</summary>
public record SearchUpdateDto(Guid Id, Guid ProjectId, string ProjectName, DateTime CreatedAt, string Snippet);

/// <summary>Busca geral do topo: poucos resultados por tipo, os mais relevantes primeiro.</summary>
public record SearchResultsDto(
    List<SearchProjectDto> Projects,
    List<SearchProgramDto> Programs,
    List<SearchActivityDto> Activities,
    List<SearchVolunteerDto> Volunteers,
    List<SearchUpdateDto> Updates);
