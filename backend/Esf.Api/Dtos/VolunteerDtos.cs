using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record VolunteerProjectDto(
    Guid ProjectId,
    string ProjectName,
    ProjectStatus ProjectStatus,
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
    DateTime CreatedAt);

public record ProjectVolunteerDto(
    Guid VolunteerId,
    string Name,
    string? Email,
    string? Phone,
    VolunteerSector Sector,
    string? RoleInProject,
    DateTime JoinedAt);

public class SaveVolunteerRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(160, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 160 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "E-mail invalido.")]
    [StringLength(200)]
    public string? Email { get; set; }

    [StringLength(40)]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Selecione o setor.")]
    public VolunteerSector? Sector { get; set; }

    public string? Skills { get; set; }
    public string? Notes { get; set; }

    [Required(ErrorMessage = "Selecione a situacao.")]
    public VolunteerStatus? Status { get; set; }
}

public class AddProjectVolunteerRequest
{
    [Required(ErrorMessage = "Selecione o voluntario.")]
    public Guid? VolunteerId { get; set; }

    [StringLength(120)]
    public string? RoleInProject { get; set; }
}
