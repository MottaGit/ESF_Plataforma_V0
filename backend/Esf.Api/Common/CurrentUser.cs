using System.Security.Claims;
using Esf.Api.Domain;

namespace Esf.Api.Common;

public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    UserRole? Role { get; }
    bool IsAdmin { get; }
    Guid RequireId();
}

public class CurrentUser : ICurrentUser
{
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

    public Guid RequireId() => Id ?? throw new AppException("Sessao invalida.", StatusCodes.Status401Unauthorized);
}
