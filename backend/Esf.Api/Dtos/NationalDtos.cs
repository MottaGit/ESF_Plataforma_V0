using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

/// <summary>Um nucleo na gestao nacional: dados basicos, numeros gerais e quem administra.</summary>
public record NucleoDto(
    Guid Id,
    string Name,
    string? City,
    string? State,
    int ActiveVolunteers,
    int ActiveProjects,
    List<NucleoAdminDto> Admins);

/// <summary>Administrador de um nucleo (contato para a gestao nacional dar suporte).</summary>
public record NucleoAdminDto(Guid UserId, string Name, string Email, bool Pending, bool IsActive);

/// <summary>Resultado de criar um nucleo ou um administrador: o link de primeiro acesso, quando ha (null: ja tinha acesso).</summary>
public record NucleoAdminResultDto(NucleoDto Nucleo, AccessLinkDto? Link);

public class SaveNucleoRequest
{
    [Required(ErrorMessage = "Informe o nome do núcleo.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(120)]
    public string? City { get; set; }

    [StringLength(60)]
    public string? State { get; set; }
}

public class CreateNucleoRequest : SaveNucleoRequest
{
    [Required(ErrorMessage = "Informe o nome de quem vai administrar o núcleo.")]
    [StringLength(160, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 160 caracteres.")]
    public string AdminName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail de quem vai administrar o núcleo.")]
    [EmailAddress(ErrorMessage = "E-mail inválido.")]
    [StringLength(200)]
    public string AdminEmail { get; set; } = string.Empty;
}

/// <summary>Pessoa (administrador de nucleo ou da gestao nacional): nome e e-mail, que e o login.</summary>
public class PersonRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(160, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 160 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail.")]
    [EmailAddress(ErrorMessage = "E-mail inválido.")]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;
}

/// <summary>Quem faz parte da gestao nacional (conta so nacional ou acesso de alguem de um nucleo).</summary>
public record NationalPersonDto(
    Guid UserId,
    string Name,
    string Email,
    // Nucleo da pessoa (null: conta so da gestao nacional).
    string? NucleoName,
    bool Pending,
    bool IsActive,
    bool IsMe);

/// <summary>Resultado de incluir alguem na gestao nacional: o link, quando a conta e nova (null: ja tinha acesso).</summary>
public record NationalPersonResultDto(NationalPersonDto Person, AccessLinkDto? Link);

/// <summary>Indicador nacional: nome, unidade e como contar (comum a todos os nucleos).</summary>
public record NationalIndicatorDto(Guid Id, string Name, string? Unit, string? Description, bool IsArchived);

public class SaveNationalIndicatorRequest
{
    [Required(ErrorMessage = "Informe o nome do indicador.")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "O nome deve ter entre 2 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(60, ErrorMessage = "A unidade deve ter no máximo 60 caracteres.")]
    public string? Unit { get; set; }

    /// <summary>Como contar, para todos os nucleos contarem do mesmo jeito.</summary>
    [StringLength(600, ErrorMessage = "A explicação deve ter no máximo 600 caracteres.")]
    public string? Description { get; set; }
}

/// <summary>
/// Painel nacional: numeros de todos os nucleos, sem dados pessoais. Tarefas concluidas, registros e horas valem no
/// periodo (From-To; sem ponta, sem limite); projetos, voluntarios ativos e indicadores sao a situacao de hoje.
/// Projetos ativos: em planejamento, em andamento ou pausados (sem os arquivados). Concluidos e indicadores contam
/// tambem os arquivados (arquivar nao apaga resultado); indicadores nao contam os cancelados (regra de ResultTotals).
/// VolunteerHours e a estimativa das horas gerais (dias como Ativo x 6 h/semana), nao as horas lancadas.
/// </summary>
public record NationalPanelDto(
    DateOnly? From,
    DateOnly? To,
    NationalTotalsDto Totals,
    List<NationalIndicatorTotalDto> Indicators,
    List<NationalNucleoRowDto> Nucleos);

public record NationalTotalsDto(
    int Nucleos,
    int ActiveProjects,
    int ConcludedProjects,
    int ActiveVolunteers,
    int VolunteerHours,
    int TasksCompleted,
    int Records);

/// <summary>
/// Indicador nacional somado em todos os nucleos, so com os valores informados: Total null quando nenhum projeto
/// informou (nao e zero); Informed de Projects projetos informaram.
/// </summary>
public record NationalIndicatorTotalDto(Guid Id, string Name, string? Unit, decimal? Total, int Informed, int Projects);

/// <summary>Valor de um indicador nacional num nucleo, com a mesma regra do total.</summary>
public record NationalIndicatorValueDto(decimal? Total, int Informed, int Projects);

public record NationalNucleoRowDto(
    Guid Id,
    string Name,
    string? City,
    string? State,
    int ActiveProjects,
    int ConcludedProjects,
    int ActiveVolunteers,
    int VolunteerHours,
    int TasksCompleted,
    int Records,
    // Ultimo registro de andamento ou tarefa concluida (mostra quem esta usando de fato).
    DateTime? LastActivityAt,
    // Valor de cada indicador nacional neste nucleo (id do indicador -> soma dos informados).
    Dictionary<Guid, NationalIndicatorValueDto> Indicators);
