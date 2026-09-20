using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt);

public class CreateUserRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(160)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail.")]
    [EmailAddress(ErrorMessage = "E-mail invalido.")]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe uma senha.")]
    [MinLength(6, ErrorMessage = "A senha deve ter ao menos 6 caracteres.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecione o perfil de acesso.")]
    public UserRole? Role { get; set; }
}

public class UpdateUserRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(160)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail.")]
    [EmailAddress(ErrorMessage = "E-mail invalido.")]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Selecione o perfil de acesso.")]
    public UserRole? Role { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Opcional: quando informada, redefine a senha do usuario.</summary>
    [MinLength(6, ErrorMessage = "A senha deve ter ao menos 6 caracteres.")]
    public string? NewPassword { get; set; }
}
