using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public record OrganizationDto(
    Guid Id,
    string Name,
    string? LegalName,
    string? Mission,
    string? About,
    string? Email,
    string? Phone,
    string? Website,
    string? City,
    string? State,
    string? LogoUrl,
    DateTime UpdatedAt);

public class SaveOrganizationRequest
{
    [Required(ErrorMessage = "Informe o nome da organizacao.")]
    [StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? LegalName { get; set; }

    public string? Mission { get; set; }
    public string? About { get; set; }

    [EmailAddress(ErrorMessage = "E-mail invalido.")]
    [StringLength(200)]
    public string? Email { get; set; }

    [StringLength(50)]
    public string? Phone { get; set; }

    [StringLength(200)]
    public string? Website { get; set; }

    [StringLength(120)]
    public string? City { get; set; }

    [StringLength(60)]
    public string? State { get; set; }
}
