using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public class LoginRequest
{
    [Required(ErrorMessage = "Informe o e-mail.")]
    [EmailAddress(ErrorMessage = "E-mail invalido.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe a senha.")]
    public string Password { get; set; } = string.Empty;
}

public record LoginResponse(string Token, DateTime ExpiresAt, UserDto User);

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Informe a senha atual.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe a nova senha.")]
    [MinLength(6, ErrorMessage = "A nova senha deve ter ao menos 6 caracteres.")]
    public string NewPassword { get; set; } = string.Empty;
}
