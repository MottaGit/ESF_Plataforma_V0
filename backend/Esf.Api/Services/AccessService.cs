using System.Security.Cryptography;
using System.Text;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Acesso a plataforma por link: a administracao da acesso a um voluntario (ou gera um link novo para quem
/// esqueceu a senha), manda o link e a propria pessoa cria a senha. Ninguem define nem repassa senha de outra pessoa.
/// </summary>
public class AccessService
{
    /// <summary>Por quantos dias o link vale.</summary>
    public const int LinkValidDays = 7;

    /// <summary>Limite de tentativas nas rotas publicas do link (ver Program.cs).</summary>
    public const string RateLimitPolicy = "access-link";

    private readonly EsfDbContext _db;
    private readonly JwtTokenService _tokens;
    private readonly ICurrentUser _currentUser;

    public AccessService(EsfDbContext db, JwtTokenService tokens, ICurrentUser currentUser)
    {
        _db = db;
        _tokens = tokens;
        _currentUser = currentUser;
    }

    /// <summary>Cria o acesso do voluntario (o login e o e-mail do cadastro) e o link de primeiro acesso.</summary>
    public async Task<AccessLinkDto> GrantAsync(Guid volunteerId, UserRole role)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == volunteerId)
                        ?? throw AppException.NotFound("Voluntário");

        if (volunteer.AnonymizedAt.HasValue)
            throw new AppException("Os dados deste voluntário foram anonimizados.");
        if (await _db.Users.AnyAsync(u => u.VolunteerId == volunteerId))
            throw AppException.Conflict("Este voluntário já tem acesso. Para quem esqueceu a senha, gere um link novo.");

        var email = volunteer.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email))
            throw new AppException("Cadastre o e-mail do voluntário antes de dar acesso: ele é o login.");
        // O e-mail e o login em toda a plataforma: nao pode repetir nem em outro nucleo.
        if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email.ToLower() == email))
            throw AppException.Conflict("Já existe um acesso com este e-mail.");

        var user = new User
        {
            OrganizationId = volunteer.OrganizationId,
            Name = volunteer.Name,
            Email = email,
            // Sem senha ate a pessoa usar o link (o login recusa enquanto isso).
            PasswordHash = string.Empty,
            Role = role,
            IsActive = true,
            VolunteerId = volunteer.Id
        };
        _db.Users.Add(user);

        var link = AddLink(user.Id);
        await _db.SaveChangesAsync();
        return link;
    }

    /// <summary>Link novo para um acesso que ja existe (primeiro acesso perdido ou senha esquecida).</summary>
    public async Task<AccessLinkDto> NewLinkAsync(Guid userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId) ?? throw AppException.NotFound("Usuário");
        if (!user.IsActive)
            throw new AppException("Este acesso está desativado. Reative antes de gerar um link.");

        // Um link novo anula os que ainda nao foram usados.
        _db.AccessLinks.RemoveRange(await _db.AccessLinks.Where(l => l.UserId == userId && l.UsedAt == null).ToListAsync());

        var link = AddLink(userId);
        await _db.SaveChangesAsync();
        return link;
    }

    public async Task<AccessLinkInfoDto> GetInfoAsync(string token)
    {
        var (_, user) = await FindValidAsync(token);
        return new AccessLinkInfoDto(user.Volunteer?.Name ?? user.Name, user.Email, user.PasswordHash.Length == 0);
    }

    /// <summary>A pessoa cria a senha (e aceita a politica): o link vale so esta vez, e ela ja sai logada.</summary>
    public async Task<LoginResponse> UseAsync(string token, UseAccessLinkRequest request)
    {
        var (link, user) = await FindValidAsync(token);
        if (!request.AcceptTerms)
            throw new AppException("Para entrar, aceite a política de privacidade e os termos de uso.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.TermsAcceptedAt = DateTime.UtcNow;
        user.TermsVersion = PrivacyTerms.CurrentVersion;
        link.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var (jwt, expiresAt) = _tokens.Create(user);
        return new LoginResponse(jwt, expiresAt, Mapping.ToDto(user));
    }

    private AccessLinkDto AddLink(Guid userId)
    {
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var link = new AccessLink
        {
            UserId = userId,
            TokenHash = Hash(token),
            ExpiresAt = DateTime.UtcNow.AddDays(LinkValidDays),
            CreatedByUserId = _currentUser.Id
        };
        _db.AccessLinks.Add(link);
        return new AccessLinkDto(userId, token, link.ExpiresAt);
    }

    private async Task<(AccessLink Link, User User)> FindValidAsync(string token)
    {
        var hash = Hash(token);
        // Rota publica: ainda nao ha login (nem nucleo); o codigo do link e que identifica a pessoa.
        var link = await _db.AccessLinks.IgnoreQueryFilters()
            .Include(l => l.User).ThenInclude(u => u!.Volunteer)
            .FirstOrDefaultAsync(l => l.TokenHash == hash);

        if (link?.User is null || link.UsedAt.HasValue || link.ExpiresAt < DateTime.UtcNow || !link.User.IsActive)
            throw new AppException(
                "Este link não vale mais: já foi usado, venceu ou foi trocado por um novo. Peça outro a quem te deu o acesso.",
                StatusCodes.Status410Gone);

        return (link, link.User);
    }

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? string.Empty)));
}
