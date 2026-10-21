using Esf.Api.Domain;

namespace Esf.Api.Dtos;

/// <summary>Tela Inicio: o que a pessoa logada tem para fazer e, para a coordenacao, o resumo da organizacao.</summary>
public record DashboardDto(
    // Numeros do usuario logado; null quando o acesso nao esta vinculado a um voluntario.
    MyActivitiesDto? Mine,
    // Tarefas em aberto do usuario logado, prazo mais proximo primeiro (vazio sem voluntario vinculado).
    IReadOnlyList<ActivityDto> MyTasks,
    // Projetos em planejamento ou em andamento em que a pessoa e responsavel ou esta na equipe.
    IReadOnlyList<HomeProjectDto> MyProjects,
    OrgSummaryDto Org,
    // Voluntarios com mais tarefas em aberto (carga da equipe).
    IReadOnlyList<VolunteerWorkloadDto> Workload);

public record HomeProjectDto(
    Guid Id,
    string Name,
    string ProgramIcon,
    string ProgramColor,
    ProjectStatus Status,
    int Progress,
    // Ultimo relato de andamento (null: nunca houve).
    DateTime? LastUpdateAt);

/// <summary>Resumo da organizacao (a tela mostra para a coordenacao).</summary>
public record OrgSummaryDto(
    int LateTasks,
    int BlockedTasks,
    int UnassignedTasks,
    // Projetos em andamento sem relato ha mais de 30 dias.
    int StaleProjects);

public record VolunteerWorkloadDto(
    Guid VolunteerId,
    string Name,
    string? PhotoUrl,
    int OpenActivities,
    int LateActivities);

public record MyActivitiesDto(int Open, int Late, int Blocked);
