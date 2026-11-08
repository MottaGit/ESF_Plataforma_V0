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
            .Select(u => new UserDto(u.Id, u.Name, u.Email, u.Role, u.IsActive, u.CreatedAt,
                u.VolunteerId, u.Volunteer != null ? u.Volunteer.Name : null,
                u.Volunteer != null && u.Volunteer.PhotoStoredName != null
                    ? Mapping.UploadsUrlPrefix + "/" + u.Volunteer.PhotoStoredName
                    : null,
                u.TermsVersion != PrivacyTerms.CurrentVersion,
                u.PasswordHash == "",
                u.OrganizationId,
                u.IsNational))
            .ToListAsync();
    }

    /// <summary>
    /// Perfil e situacao do acesso. Nome e e-mail vem do cadastro do voluntario (e mudam la); um acesso antigo, sem
    /// voluntario, pode ser ligado a um aqui e passa a usar o nome e o e-mail dele.
    /// </summary>
    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, Guid currentUserId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Usuário");

        if (id == currentUserId && !request.IsActive)
            throw new AppException("Você não pode desativar o próprio acesso.");

        if (request.VolunteerId.HasValue && request.VolunteerId != user.VolunteerId)
        {
            await EnsureVolunteerAvailableAsync(request.VolunteerId, id);
            var volunteer = await _db.Volunteers.FirstAsync(v => v.Id == request.VolunteerId.Value);
            var email = volunteer.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(email))
                throw new AppException("Cadastre o e-mail do voluntário antes: ele é o login.");
            // O e-mail e o login em toda a plataforma: nao pode repetir nem em outro nucleo.
            if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id != id && u.Email.ToLower() == email))
                throw AppException.Conflict("Já existe um acesso com o e-mail deste voluntário.");

            user.VolunteerId = volunteer.Id;
            user.Name = volunteer.Name;
            user.Email = email;
        }

        user.Role = request.Role!.Value;
        user.IsActive = request.IsActive;

        await _db.SaveChangesAsync();
        return await GetDtoAsync(id);
    }

    public async Task DeleteAsync(Guid id, Guid currentUserId)
    {
        if (id == currentUserId)
            throw new AppException("Você não pode excluir o próprio usuário.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Usuário");

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
    }

    private async Task<UserDto> GetDtoAsync(Guid id)
    {
        var user = await _db.Users.AsNoTracking().Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Id == id)
                   ?? throw AppException.NotFound("Usuário");
        return Mapping.ToDto(user);
    }

    /// <summary>O voluntario precisa existir e nao pode estar vinculado a outro acesso.</summary>
    private async Task EnsureVolunteerAvailableAsync(Guid? volunteerId, Guid? userId)
    {
        if (!volunteerId.HasValue) return;

        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId.Value))
            throw AppException.NotFound("Voluntário");

        if (await _db.Users.AnyAsync(u => u.VolunteerId == volunteerId.Value && u.Id != userId))
            throw AppException.Conflict("Este voluntário já está vinculado a outro usuário.");
    }
}
