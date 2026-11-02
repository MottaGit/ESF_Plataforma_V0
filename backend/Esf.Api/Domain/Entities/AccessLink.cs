namespace Esf.Api.Domain.Entities;

/// <summary>
/// Link de acesso: a pessoa abre, cria a propria senha e ja entra. Serve para o primeiro acesso e para quem
/// esqueceu a senha. Vale uma vez, por poucos dias, e so o hash do codigo fica no banco.
/// </summary>
public class AccessLink
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User? User { get; set; }

    /// <summary>SHA-256 do codigo do link (o codigo em si so aparece uma vez, para quem gerou).</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    /// <summary>Quem gerou o link.</summary>
    public Guid? CreatedByUserId { get; set; }
}
