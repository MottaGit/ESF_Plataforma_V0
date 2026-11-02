namespace Esf.Api.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Nucleo do acesso (o mesmo do voluntario). Vazio so em contas da gestao nacional.</summary>
    public Guid? OrganizationId { get; set; }

    /// <summary>
    /// Faz parte da gestao nacional (ve os numeros de todos os nucleos e cuida dos nucleos e dos indicadores nacionais).
    /// Pode ser uma conta so nacional ou o acesso de alguem de um nucleo.
    /// </summary>
    public bool IsNational { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Usuario;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Voluntario que este acesso representa. Permite saber quais atividades sao "minhas".</summary>
    public Guid? VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    /// <summary>Quando aceitou a politica de privacidade e os termos de uso, e qual versao.</summary>
    public DateTime? TermsAcceptedAt { get; set; }
    public string? TermsVersion { get; set; }

    /// <summary>Senhas erradas seguidas; ao chegar no limite, o acesso fica bloqueado ate LockedUntil.</summary>
    public int FailedLoginCount { get; set; }
    public DateTime? LockedUntil { get; set; }
}
