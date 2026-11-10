using System.Security.Claims;
using Esf.Api.Domain;

namespace Esf.Api.Common;

public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    UserRole? Role { get; }
    bool IsAdmin { get; }
    /// <summary>Nucleo de quem esta logado (vazio em conta so da gestao nacional ou sem login).</summary>
    Guid? OrganizationId { get; }
    /// <summary>Faz parte da gestao nacional.</summary>
    bool IsNational { get; }
    Guid RequireId();
}

public class CurrentUser : ICurrentUser
{
    /// <summary>Claim do token com o nucleo do acesso.</summary>
    public const string OrganizationClaim = "org";

    /// <summary>Claim do token de quem faz parte da gestao nacional.</summary>
    public const string NationalClaim = "nacional";

    private readonly ClaimsPrincipal? _principal;

    public CurrentUser(IHttpContextAccessor accessor)
    {
        _principal = accessor.HttpContext?.User;
    }

    public Guid? Id =>
        Guid.TryParse(_principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    public string? Name => _principal?.FindFirst(ClaimTypes.Name)?.Value;

    public UserRole? Role =>
        Enum.TryParse<UserRole>(_principal?.FindFirst(ClaimTypes.Role)?.Value, out var role) ? role : null;

    public bool IsAdmin => Role == UserRole.Administrador;

    public Guid? OrganizationId =>
        Guid.TryParse(_principal?.FindFirst(OrganizationClaim)?.Value, out var id) ? id : null;

    public bool IsNational => _principal?.FindFirst(NationalClaim) is not null;

    public Guid RequireId() => Id ?? throw new AppException("Sessão inválida.", StatusCodes.Status401Unauthorized);
}

/// <summary>
/// Quem uma tarefa em segundo plano representa (nao ha requisicao nem token). O JobWorker preenche antes de pedir os
/// servicos do escopo; o ICurrentUser registrado no Program.cs usa este, quando houver, no lugar do login.
/// </summary>
public class CurrentUserOverride
{
    public ICurrentUser? User { get; set; }
}

/// <summary>Quem pediu a tarefa em segundo plano, com o nucleo e o perfil da hora do pedido.</summary>
public sealed class JobUser : ICurrentUser
{
    public JobUser(Guid id, string name, UserRole? role, Guid organizationId)
    {
        Id = id;
        Name = name;
        Role = role;
        OrganizationId = organizationId;
    }

    public Guid? Id { get; }
    public string? Name { get; }
    public UserRole? Role { get; }
    public bool IsAdmin => Role == UserRole.Administrador;
    public Guid? OrganizationId { get; }
    public bool IsNational => false;

    public Guid RequireId() => Id!.Value;
}
