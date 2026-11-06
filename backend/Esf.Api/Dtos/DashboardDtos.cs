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
    // Voluntarios ativos sem nenhuma tarefa em aberto: primeiro quem tambem nao esta em nenhum projeto.
    IReadOnlyList<IdleVolunteerDto> Idle,
    // Primeiros passos de um nucleo que esta comecando (null quando o nucleo ja tem projeto).
    SetupDto? Setup);

/// <summary>
/// Primeiros passos do nucleo novo, cada um marcado sozinho: dados do nucleo (CNPJ e quem assina), um programa e mais
/// alguem com acesso. O ultimo passo e o primeiro projeto: quando ele existe, o quadro some.
/// </summary>
public record SetupDto(bool OrganizationDone, bool ProgramDone, bool TeamDone);

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
    // Projetos em andamento sem relato ha mais de 30 dias.
    int StaleProjects);

public record IdleVolunteerDto(
    Guid VolunteerId,
    string Name,
    string? PhotoUrl,
    // Projetos em planejamento ou em andamento em que a pessoa e responsavel ou esta na equipe.
    int Projects);

public record MyActivitiesDto(int Open, int Late, int Blocked);
