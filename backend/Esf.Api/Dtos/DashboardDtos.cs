namespace Esf.Api.Dtos;

/// <summary>Visao geral voltada para o trabalho do dia a dia: atividades e voluntarios.</summary>
public record DashboardDto(
    DashboardTotalsDto Totals,
    // Atividades que pedem acao (atrasadas, vencendo em 7 dias ou sem responsavel), mais urgentes primeiro.
    IReadOnlyList<ActivityDto> Attention,
    // Voluntarios com mais atividades em aberto (carga da equipe).
    IReadOnlyList<VolunteerWorkloadDto> Workload,
    // Numeros do usuario logado; null quando o acesso nao esta vinculado a um voluntario.
    MyActivitiesDto? Mine,
    IReadOnlyList<ActivityDto> UpcomingActivities);

public record DashboardTotalsDto(
    int LateActivities,
    int DueSoonActivities,
    int InProgressActivities,
    int ActiveVolunteers,
    int ActiveVolunteersWithoutOpenActivities);

public record VolunteerWorkloadDto(
    Guid VolunteerId,
    string Name,
    string? PhotoUrl,
    int OpenActivities,
    int LateActivities);

public record MyActivitiesDto(int Open, int Late, int DueSoon);
