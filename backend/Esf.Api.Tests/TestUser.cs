using Esf.Api.Common;
using Esf.Api.Domain;

namespace Esf.Api.Tests;

/// <summary>Quem esta "logado" no teste: o mesmo que o token traria (id, perfil e nucleo).</summary>
public class TestUser : ICurrentUser
{
    public Guid? Id { get; init; }
    public string? Name { get; init; }
    public UserRole? Role { get; init; }
    public bool IsAdmin => Role == UserRole.Administrador;
    public Guid? OrganizationId { get; init; }

    public Guid RequireId() => Id ?? throw new AppException("Sessao invalida.", 401);

    /// <summary>Sem login (rotas publicas: entrar, link de acesso).</summary>
    public static readonly TestUser Anonymous = new();
}
