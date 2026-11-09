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
    bool PasswordPending,
    // Nucleo do acesso (vazio: conta so da gestao nacional).
    Guid? OrganizationId,
    // Faz parte da gestao nacional.
    bool IsNational,
    // Validade do link de acesso ainda nao usado mais recente (null: nenhum); so na lista de acessos.
    DateTime? LinkExpiresAt = null);

/// <summary>
/// Edicao de um acesso: perfil e situacao. Nome e e-mail (o login) vem do cadastro do voluntario e mudam la.
/// </summary>
public class UpdateUserRequest
{
    [Required(ErrorMessage = "Selecione o perfil de acesso.")]
    public UserRole? Role { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>So para acesso antigo, sem voluntario: liga ao cadastro, que passa a dar o nome e o e-mail.</summary>
    public Guid? VolunteerId { get; set; }
}
