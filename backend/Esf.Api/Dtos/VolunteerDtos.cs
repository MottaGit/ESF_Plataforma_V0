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
    VolunteerAccessDto? Access);

/// <summary>Acesso de um voluntario: perfil, se esta ativo e se ainda espera o primeiro acesso (sem senha).</summary>
public record VolunteerAccessDto(Guid UserId, UserRole Role, bool IsActive, bool Pending);

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
}

public class AddProjectVolunteerRequest
{
    [Required(ErrorMessage = "Selecione o voluntário.")]
    public Guid? VolunteerId { get; set; }

    [StringLength(120)]
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
