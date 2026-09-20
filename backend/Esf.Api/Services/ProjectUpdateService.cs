using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ProjectUpdateService
{
    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public ProjectUpdateService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<List<ProjectUpdateDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var updates = await _db.ProjectUpdates
            .AsNoTracking()
            .Include(u => u.AuthorUser)
            .Include(u => u.Attachments)
            .Where(u => u.ProjectId == projectId)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        return updates.Select(Mapping.ToDto).ToList();
    }

    public async Task<ProjectUpdateDto> CreateAsync(Guid projectId, CreateProjectUpdateRequest request, Guid? authorUserId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var update = new ProjectUpdate
        {
            ProjectId = projectId,
            Text = request.Text.Trim(),
            AuthorUserId = authorUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.ProjectUpdates.Add(update);

        foreach (var file in request.Files)
            update.Attachments.Add(await SaveAttachmentAsync(file, authorUserId));

        await TouchProjectAsync(projectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(update.Id);
    }

    public async Task<ProjectUpdateDto> UpdateAsync(Guid id, SaveProjectUpdateRequest request)
    {
        var update = await _db.ProjectUpdates.FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Atualizacao");

        update.Text = request.Text.Trim();
        update.EditedAt = DateTime.UtcNow;

        await TouchProjectAsync(update.ProjectId);
        await _db.SaveChangesAsync();

        return await GetDtoAsync(id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var update = await _db.ProjectUpdates
            .Include(u => u.Attachments)
            .FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Atualizacao");

        var storedNames = update.Attachments.Select(f => f.StoredName).ToList();

        _db.ProjectUpdates.Remove(update);
        await TouchProjectAsync(update.ProjectId);
        await _db.SaveChangesAsync();

        _storage.DeleteMany(storedNames);
    }

    public async Task<ProjectFileDto> AddAttachmentAsync(Guid updateId, IFormFile file, Guid? uploadedByUserId)
    {
        var update = await _db.ProjectUpdates.FirstOrDefaultAsync(u => u.Id == updateId)
                     ?? throw AppException.NotFound("Atualizacao");

        var attachment = await SaveAttachmentAsync(file, uploadedByUserId);
        attachment.ProjectUpdateId = updateId;

        _db.ProjectFiles.Add(attachment);
        await TouchProjectAsync(update.ProjectId);
        await _db.SaveChangesAsync();

        if (attachment.UploadedByUserId.HasValue)
            await _db.Entry(attachment).Reference(f => f.UploadedByUser).LoadAsync();

        return Mapping.ToDto(attachment);
    }

    public async Task RemoveAttachmentAsync(Guid updateId, Guid fileId)
    {
        var attachment = await _db.ProjectFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectUpdateId == updateId)
            ?? throw AppException.NotFound("Anexo");

        _db.ProjectFiles.Remove(attachment);
        await _db.SaveChangesAsync();

        _storage.Delete(attachment.StoredName);
    }

    private async Task<ProjectFile> SaveAttachmentAsync(IFormFile file, Guid? uploadedByUserId)
    {
        var saved = await _storage.SaveAsync(file);

        return new ProjectFile
        {
            FileName = saved.OriginalName.Length > 260 ? saved.OriginalName[..260] : saved.OriginalName,
            StoredName = saved.StoredName,
            ContentType = saved.ContentType,
            SizeBytes = saved.Size,
            UploadedByUserId = uploadedByUserId,
            UploadedAt = DateTime.UtcNow
        };
    }

    private async Task<ProjectUpdateDto> GetDtoAsync(Guid id)
    {
        var update = await _db.ProjectUpdates
            .AsNoTracking()
            .Include(u => u.AuthorUser)
            .Include(u => u.Attachments)
            .FirstOrDefaultAsync(u => u.Id == id) ?? throw AppException.NotFound("Atualizacao");

        return Mapping.ToDto(update);
    }

    private async Task TouchProjectAsync(Guid projectId)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is not null) project.UpdatedAt = DateTime.UtcNow;
    }
}
