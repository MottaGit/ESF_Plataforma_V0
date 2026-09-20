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

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new AppException("E-mail ou senha incorretos.", StatusCodes.Status401Unauthorized);

        if (!user.IsActive)
            throw new AppException("Este acesso esta desativado. Fale com um administrador.", StatusCodes.Status403Forbidden);

        var (token, expiresAt) = _tokens.Create(user);
        return new LoginResponse(token, expiresAt, Mapping.ToDto(user));
    }

    public async Task<UserDto> MeAsync(Guid userId)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)
                   ?? throw AppException.NotFound("Usuario");
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
