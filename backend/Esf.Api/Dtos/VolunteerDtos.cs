using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record VolunteerProjectDto(
    Guid ProjectId,
    string ProjectName,
    ProjectStatus ProjectStatus,
    string ProgramName,
    string? RoleInProject);

public record VolunteerDto(
    Guid Id,
    string Name,
    string? Email,
    string? Phone,
    VolunteerSector Sector,
    string? Skills,
    string? Notes,
    VolunteerStatus Status,
    List<VolunteerProjectDto> Projects,
    DateTime CreatedAt,
    int? BirthDay,
    int? BirthMonth,
    string? PhotoUrl,
    // Data do termo de adesao assinado mais recente (null: termo pendente).
    DateOnly? TermSignedOn,
    // Dados pessoais ja anonimizados: so o historico continua.
    bool Anonymized,
    // Acesso a plataforma ligado a este voluntario (null: sem acesso).
    VolunteerAccessDto? Access,
    // Bairro, deslocamento e turnos livres: so para a coordenacao e para a propria pessoa (null para os demais).
    VolunteerAvailabilityDto? Availability = null);

/// <summary>Um turno livre na grade de disponibilidade.</summary>
public record AvailabilitySlotDto(WeekDay Day, Shift Shift);

/// <summary>
/// Onde o voluntario mora (bairro e cidade), como se desloca e em que turnos costuma estar livre. Located: o bairro
/// tem ponto no mapa (sem ele, a distancia ate a obra nao aparece); Latitude/Longitude: esse ponto, aproximado (centro
/// do bairro ou um toque no mapa, arredondado). UpdatedAt vazio: nunca preenchido.
/// </summary>
public record VolunteerAvailabilityDto(
    string? District,
    string? City,
    bool Located,
    TransportMode? Transport,
    List<AvailabilitySlotDto> Slots,
    DateTime? UpdatedAt,
    double? Latitude = null,
    double? Longitude = null);

/// <summary>Bairro, deslocamento e turnos, salvos pela propria pessoa (Minha conta) ou pela coordenacao.</summary>
public class SaveAvailabilityRequest
{
    [StringLength(120, ErrorMessage = "O bairro deve ter no máximo 120 caracteres.")]
    public string? District { get; set; }

    [StringLength(120, ErrorMessage = "A cidade deve ter no máximo 120 caracteres.")]
    public string? City { get; set; }

    /// <summary>
    /// Ponto aproximado do bairro, escolhido na busca do mapa (centro do bairro) ou com um toque no mapa. A API guarda
    /// com 3 casas decimais (uns 100 m), nunca o ponto exato. Vazio com o mesmo bairro e cidade: fica o ponto que ja
    /// havia; vazio com outro lugar: sem ponto.
    /// </summary>
    [Range(-90, 90, ErrorMessage = "Latitude inválida.")]
    public double? Latitude { get; set; }

    [Range(-180, 180, ErrorMessage = "Longitude inválida.")]
    public double? Longitude { get; set; }

    public TransportMode? Transport { get; set; }

    public List<AvailabilitySlotDto>? Slots { get; set; }
}

/// <summary>Acesso de um voluntario: perfil, se esta ativo e se ainda espera o primeiro acesso (sem senha).</summary>
/// <remarks>LinkExpiresAt: validade do link de acesso ainda nao usado mais recente (null: nenhum).</remarks>
public record VolunteerAccessDto(Guid UserId, UserRole Role, bool IsActive, bool Pending, DateTime? LinkExpiresAt = null);

/// <summary>
/// Carga de um voluntario para escolher o responsavel por uma tarefa: situacao e tarefas em aberto (e atrasadas)
/// nos projetos em planejamento ou em andamento.
/// </summary>
public record VolunteerLoadDto(Guid VolunteerId, VolunteerStatus Status, int OpenActivities, int LateActivities);

public record ProjectVolunteerDto(
    Guid VolunteerId,
    string Name,
    string? Email,
    string? Phone,
    VolunteerSector Sector,
    string? RoleInProject,
    DateTime JoinedAt,
    string? PhotoUrl);

public class SaveVolunteerRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(160, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 160 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "E-mail inválido.")]
    [StringLength(200)]
    public string? Email { get; set; }

    [StringLength(40)]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Selecione o setor.")]
    public VolunteerSector? Sector { get; set; }

    public string? Skills { get; set; }
    public string? Notes { get; set; }

    [Required(ErrorMessage = "Selecione a situação.")]
    public VolunteerStatus? Status { get; set; }

    /// <summary>Aniversario (opcional): dia e mes, sem ano.</summary>
    [Range(1, 31, ErrorMessage = "Dia de aniversário inválido.")]
    public int? BirthDay { get; set; }

    [Range(1, 12, ErrorMessage = "Mês de aniversário inválido.")]
    public int? BirthMonth { get; set; }

    /// <summary>
    /// So no cadastro novo: desde quando a pessoa esta no nucleo. O historico de situacao (e as horas de
    /// voluntariado) comeca nesse dia; vazio, hoje.
    /// </summary>
    public DateOnly? ActiveSince { get; set; }

    /// <summary>
    /// Saindo do nucleo (Inativo ou Ex-membro): desativa tambem o acesso a plataforma (a pessoa deixa de entrar e de
    /// ver os contatos de todos). Ignorado nas outras situacoes.
    /// </summary>
    public bool DeactivateAccess { get; set; }

    /// <summary>
    /// Saindo do nucleo (Inativo ou Ex-membro): as tarefas em aberto dela ficam sem responsavel, para a coordenacao
    /// reatribuir (Tarefas > Sem responsavel). Ignorado nas outras situacoes.
    /// </summary>
    public bool ReleaseTasks { get; set; }
}

public class AddProjectVolunteerRequest
{
    [Required(ErrorMessage = "Selecione o voluntário.")]
    public Guid? VolunteerId { get; set; }

    [StringLength(120, ErrorMessage = "A função no projeto deve ter no máximo 120 caracteres.")]
    public string? RoleInProject { get; set; }
}

/// <summary>Funcao de quem ja esta na equipe (vazio: sem funcao definida).</summary>
public class UpdateProjectVolunteerRequest
{
    [StringLength(120, ErrorMessage = "A função no projeto deve ter no máximo 120 caracteres.")]
    public string? RoleInProject { get; set; }
}

/// <summary>Um periodo do historico de status (EndsOn vazio: o status atual).</summary>
public record VolunteerStatusPeriodDto(Guid Id, VolunteerStatus Status, DateOnly StartsOn, DateOnly? EndsOn);

/// <summary>
/// Horas de voluntariado (dias como Ativo x carga semanal). O historico so vem para a coordenacao e para o
/// proprio voluntario; para os demais, null.
/// </summary>
public record VolunteerHoursDto(int Hours, int WeeklyHours, List<VolunteerStatusPeriodDto>? History);

/// <summary>"Status X de tal data ate tal data (ou ate hoje)" no historico do voluntario.</summary>
public class SaveStatusPeriodRequest
{
    [Required(ErrorMessage = "Selecione o status.")]
    public VolunteerStatus? Status { get; set; }

    [Required(ErrorMessage = "Informe a data de início.")]
    public DateOnly? StartsOn { get; set; }

    /// <summary>Vazio: continua ate hoje (vira o status atual).</summary>
    public DateOnly? EndsOn { get; set; }
}
