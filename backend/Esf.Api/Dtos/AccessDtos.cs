using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

/// <summary>Link de acesso recem-gerado. O codigo so volta nesta resposta: depois disso, so um link novo.</summary>
public record AccessLinkDto(Guid UserId, string Token, DateTime ExpiresAt);

/// <summary>O que a pagina publica do link mostra antes de a pessoa criar a senha.</summary>
public record AccessLinkInfoDto(string Name, string Email, bool FirstAccess);

public class GrantAccessRequest
{
    [Required(ErrorMessage = "Selecione o perfil de acesso.")]
    public UserRole? Role { get; set; }
}

public class UseAccessLinkRequest
{
    [Required(ErrorMessage = "Informe a nova senha.")]
    [MinLength(6, ErrorMessage = "A senha deve ter ao menos 6 caracteres.")]
    public string Password { get; set; } = string.Empty;

    /// <summary>Aceite da politica de privacidade e dos termos de uso, pedido junto com a senha.</summary>
    public bool AcceptTerms { get; set; }
}
