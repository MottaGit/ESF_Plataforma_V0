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
    [Required(ErrorMessage = "Informe o nome do nucleo.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 200 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(120)]
    public string? City { get; set; }

    [StringLength(60)]
    public string? State { get; set; }
}

public class CreateNucleoRequest : SaveNucleoRequest
{
    [Required(ErrorMessage = "Informe o nome de quem vai administrar o nucleo.")]
    [StringLength(160, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 160 caracteres.")]
    public string AdminName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail de quem vai administrar o nucleo.")]
    [EmailAddress(ErrorMessage = "E-mail invalido.")]
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
    [EmailAddress(ErrorMessage = "E-mail invalido.")]
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
