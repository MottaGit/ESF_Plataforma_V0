using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class UserService
{
    private readonly EsfDbContext _db;

    public UserService(EsfDbContext db) => _db = db;

    public async Task<List<UserDto>> ListAsync(bool onlyActive = false)
    {
        var query = _db.Users.AsNoTracking().AsQueryable();
        if (onlyActive) query = query.Where(u => u.IsActive);

        return await query
            .OrderBy(u => u.Name)
            .Select(u => new UserDto(u.Id, u.Name, u.Email, u.Role, u.IsActive, u.CreatedAt))
            .ToListAsync();
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == email))
            throw AppException.Conflict("Ja existe um usuario com este e-mail.");

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role!.Value,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return Mapping.ToDto(user);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid currentUserId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Usuario");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Id != id && u.Email.ToLower() == email))
            throw AppException.Conflict("Ja existe um usuario com este e-mail.");

        if (id == currentUserId && !request.IsActive)
            throw new AppException("Voce nao pode desativar o proprio acesso.");

        user.Name = request.Name.Trim();
        user.Email = email;
        user.Role = request.Role!.Value;
        user.IsActive = request.IsActive;

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        await _db.SaveChangesAsync();
        return Mapping.ToDto(user);
    }

    public async Task DeleteAsync(Guid id, Guid currentUserId)
    {
        if (id == currentUserId)
            throw new AppException("Voce nao pode excluir o proprio usuario.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Usuario");

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
    }
}
