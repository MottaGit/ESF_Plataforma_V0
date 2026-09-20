using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class OrganizationService
{
    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public OrganizationService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<OrganizationDto> GetAsync()
    {
        var org = await GetEntityAsync();
        return Mapping.ToDto(org);
    }

    public async Task<OrganizationDto> UpdateAsync(SaveOrganizationRequest request)
    {
        var org = await GetEntityAsync();

        org.Name = request.Name.Trim();
        org.LegalName = Clean(request.LegalName);
        org.Mission = Clean(request.Mission);
        org.About = Clean(request.About);
        org.Email = Clean(request.Email);
        org.Phone = Clean(request.Phone);
        org.Website = Clean(request.Website);
        org.City = Clean(request.City);
        org.State = Clean(request.State);
        org.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Mapping.ToDto(org);
    }

    public async Task<OrganizationDto> UpdateLogoAsync(IFormFile file)
    {
        var contentType = file.ContentType ?? string.Empty;
        if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new AppException("O logo deve ser uma imagem.");

        var org = await GetEntityAsync();
        var saved = await _storage.SaveAsync(file);

        if (!string.IsNullOrWhiteSpace(org.LogoUrl))
        {
            var previous = org.LogoUrl.Split('/').Last();
            _storage.Delete(previous);
        }

        org.LogoUrl = $"{Mapping.UploadsUrlPrefix}/{saved.StoredName}";
        org.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Mapping.ToDto(org);
    }

    /// <summary>A V0 mantem um unico registro institucional; cria na primeira chamada se nao existir.</summary>
    private async Task<Organization> GetEntityAsync()
    {
        var org = await _db.Organizations.OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync();
        if (org is not null) return org;

        org = new Organization { Name = "Engenheiros Sem Fronteiras", UpdatedAt = DateTime.UtcNow };
        _db.Organizations.Add(org);
        await _db.SaveChangesAsync();
        return org;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
