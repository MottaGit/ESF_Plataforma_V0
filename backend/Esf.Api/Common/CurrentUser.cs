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
