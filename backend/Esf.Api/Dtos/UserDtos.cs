using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt,
    Guid? VolunteerId,
    string? VolunteerName,
    // Foto do voluntario vinculado (avatar do usuario no topo da tela).
    string? VolunteerPhotoUrl,
    // Ainda nao aceitou a versao vigente da politica de privacidade e dos termos de uso.
    bool TermsPending,
    // Criado por link e ainda sem senha (aguardando o primeiro acesso).
    bool PasswordPending);

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

    /// <summary>Voluntario que este acesso representa (opcional).</summary>
    public Guid? VolunteerId { get; set; }
}
