namespace Esf.Api.Dtos;

/// <summary>Visao geral voltada para o trabalho do dia a dia: atividades e voluntarios.</summary>
public record DashboardDto(
    DashboardTotalsDto Totals,
    // Atividades que pedem acao (atrasadas, bloqueadas ou sem responsavel), mais urgentes primeiro.
    IReadOnlyList<ActivityDto> Attention,
    // Voluntarios com mais atividades em aberto (carga da equipe).
    IReadOnlyList<VolunteerWorkloadDto> Workload,
    // Numeros do usuario logado; null quando o acesso nao esta vinculado a um voluntario.
    MyActivitiesDto? Mine,
    // Proximas atividades em aberto do usuario logado (vazio sem voluntario vinculado).
    IReadOnlyList<ActivityDto> MyUpcoming);

public record DashboardTotalsDto(
    int LateActivities,
    int BlockedActivities,
    // Concluidas nos ultimos 30 dias: o ritmo da equipe.
    int CompletedLast30Days,
    int InProgressActivities,
    int ActiveVolunteers,
    int ActiveVolunteersWithoutOpenActivities);

public record VolunteerWorkloadDto(
    Guid VolunteerId,
    string Name,
    string? PhotoUrl,
    int OpenActivities,
    int LateActivities);

public record MyActivitiesDto(int Open, int Late, int Blocked);
