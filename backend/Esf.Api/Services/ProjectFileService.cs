using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ProjectFileService
{
    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public ProjectFileService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<List<ProjectFileDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var files = await _db.ProjectFiles
            .AsNoTracking()
            .Include(f => f.UploadedByUser)
            .Where(f => f.ProjectId == projectId && f.ProjectUpdateId == null)
            .OrderByDescending(f => f.UploadedAt)
            .ToListAsync();

        return files.Select(Mapping.ToDto).ToList();
    }

    public async Task<ProjectFileDto> UploadAsync(Guid projectId, IFormFile file, string? description, Guid? userId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var saved = await _storage.SaveAsync(file);

        var entity = new ProjectFile
        {
            ProjectId = projectId,
            FileName = saved.OriginalName.Length > 260 ? saved.OriginalName[..260] : saved.OriginalName,
            StoredName = saved.StoredName,
            ContentType = saved.ContentType,
            SizeBytes = saved.Size,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            UploadedByUserId = userId,
            UploadedAt = DateTime.UtcNow
        };

        _db.ProjectFiles.Add(entity);

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is not null) project.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        if (entity.UploadedByUserId.HasValue)
            await _db.Entry(entity).Reference(f => f.UploadedByUser).LoadAsync();

        return Mapping.ToDto(entity);
    }

    public async Task<(string Path, string ContentType, string FileName)> GetDownloadAsync(Guid fileId)
    {
        var file = await _db.ProjectFiles.AsNoTracking().FirstOrDefaultAsync(f => f.Id == fileId)
                   ?? throw AppException.NotFound("Arquivo");

        var path = _storage.FullPathOrNull(file.StoredName)
                   ?? throw AppException.NotFound("Arquivo fisico");

        return (path, file.ContentType, file.FileName);
    }

    public async Task DeleteAsync(Guid fileId)
    {
        var file = await _db.ProjectFiles.FirstOrDefaultAsync(f => f.Id == fileId) ?? throw AppException.NotFound("Arquivo");

        _db.ProjectFiles.Remove(file);
        await _db.SaveChangesAsync();

        _storage.Delete(file.StoredName);
    }
}
