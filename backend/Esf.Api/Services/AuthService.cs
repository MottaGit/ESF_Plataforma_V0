using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class AuthService
{
    private readonly EsfDbContext _db;
    private readonly JwtTokenService _tokens;

    public AuthService(EsfDbContext db, JwtTokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    /// <summary>Senhas erradas seguidas ate o acesso ser bloqueado.</summary>
    public const int MaxFailedAttempts = 10;

    /// <summary>Por quanto tempo o acesso fica bloqueado depois de MaxFailedAttempts erros.</summary>
    public const int LockoutMinutes = 15;

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user is null)
            throw new AppException("E-mail ou senha incorretos.", StatusCodes.Status401Unauthorized);

        // Bloqueado: nem confere a senha, para nao dar pista se ela esta certa.
        if (user.LockedUntil > DateTime.UtcNow) throw Locked(user.LockedUntil.Value);

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedAttempts)
            {
                user.FailedLoginCount = 0;
                user.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                await _db.SaveChangesAsync();
                throw Locked(user.LockedUntil.Value);
            }

            await _db.SaveChangesAsync();
            throw new AppException("E-mail ou senha incorretos.", StatusCodes.Status401Unauthorized);
        }

        if (!user.IsActive)
            throw new AppException("Este acesso esta desativado. Fale com um administrador.", StatusCodes.Status403Forbidden);

        if (user.FailedLoginCount != 0 || user.LockedUntil.HasValue)
        {
            user.FailedLoginCount = 0;
            user.LockedUntil = null;
            await _db.SaveChangesAsync();
        }

        var (token, expiresAt) = _tokens.Create(user);
        return new LoginResponse(token, expiresAt, Mapping.ToDto(user));
    }

    private static AppException Locked(DateTime until)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling((until - DateTime.UtcNow).TotalMinutes));
        return new AppException(
            $"Muitas tentativas com a senha errada. Por seguranca, este acesso esta bloqueado; tente de novo em {minutes} minuto(s).",
            StatusCodes.Status429TooManyRequests);
    }

    public async Task<UserDto> MeAsync(Guid userId)
    {
        var user = await _db.Users.AsNoTracking().Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Id == userId)
                   ?? throw AppException.NotFound("Usuario");
        return Mapping.ToDto(user);
    }

    /// <summary>Registra o aceite da versao vigente da politica de privacidade e dos termos de uso.</summary>
    public async Task<UserDto> AcceptTermsAsync(Guid userId)
    {
        var user = await _db.Users.Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Id == userId)
                   ?? throw AppException.NotFound("Usuario");

        user.TermsAcceptedAt = DateTime.UtcNow;
        user.TermsVersion = PrivacyTerms.CurrentVersion;
        await _db.SaveChangesAsync();
        return Mapping.ToDto(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
                   ?? throw AppException.NotFound("Usuario");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new AppException("A senha atual nao confere.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
    }
}
