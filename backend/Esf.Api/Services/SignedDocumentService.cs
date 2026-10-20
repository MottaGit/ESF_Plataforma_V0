using System.Globalization;
using System.Text;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Termos de adesao de voluntarios e autorizacoes de uso de imagem dos beneficiarios: modelo em PDF para
/// assinar, envio do arquivo assinado e download. Os arquivos sao privados (nao saem por /uploads).
/// </summary>
public class SignedDocumentService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png"
    };

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ICurrentUser _currentUser;

    public SignedDocumentService(EsfDbContext db, FileStorageService storage, ICurrentUser currentUser)
    {
        _db = db;
        _storage = storage;
        _currentUser = currentUser;
    }

    public Task<List<SignedDocumentDto>> ListForVolunteerAsync(Guid volunteerId) =>
        ToDtos(_db.SignedDocuments.Where(d => d.VolunteerId == volunteerId));

    public Task<List<SignedDocumentDto>> ListForProjectAsync(Guid projectId) =>
        ToDtos(_db.SignedDocuments.Where(d => d.ProjectId == projectId));

    public async Task<SignedDocumentDto> UploadForVolunteerAsync(Guid volunteerId, UploadSignedDocumentRequest request)
    {
        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId)) throw AppException.NotFound("Voluntario");
        return await UploadAsync(SignedDocumentKind.VolunteerTerm, volunteerId, null, request);
    }

    public async Task<SignedDocumentDto> UploadForProjectAsync(Guid projectId, UploadSignedDocumentRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId)) throw AppException.NotFound("Projeto");
        return await UploadAsync(SignedDocumentKind.BeneficiaryImageAuthorization, null, projectId, request);
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> GetDownloadAsync(Guid id)
    {
        var document = await _db.SignedDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id)
                       ?? throw AppException.NotFound("Documento");
        var content = await _storage.TryReadAsync(document.StoredName) ?? throw AppException.NotFound("Conteudo do documento");
        return (content, FileStorageService.ContentTypeFor(document.StoredName), document.FileName);
    }

    public async Task DeleteAsync(Guid id)
    {
        var document = await _db.SignedDocuments.FirstOrDefaultAsync(d => d.Id == id) ?? throw AppException.NotFound("Documento");
        _db.SignedDocuments.Remove(document);
        await _db.SaveChangesAsync();
        await _storage.DeleteAsync(document.StoredName);
    }

    /// <summary>Termo de adesao (com autorizacao de uso de imagem) ja com o nome do voluntario, para imprimir e assinar.</summary>
    public async Task<(byte[] Content, string FileName)> VolunteerTermTemplateAsync(Guid volunteerId)
    {
        var volunteer = await _db.Volunteers.AsNoTracking().FirstOrDefaultAsync(v => v.Id == volunteerId)
                        ?? throw AppException.NotFound("Voluntario");
        var org = await OrganizationAsync();
        return (DocumentTemplates.VolunteerTerm(org, volunteer), $"termo-de-adesao-{Slug(volunteer.Name)}.pdf");
    }

    /// <summary>Autorizacao de uso de imagem para as familias do projeto assinarem (uma por familia).</summary>
    public async Task<(byte[] Content, string FileName)> ImageAuthorizationTemplateAsync(Guid projectId)
    {
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId)
                      ?? throw AppException.NotFound("Projeto");
        var org = await OrganizationAsync();
        return (DocumentTemplates.BeneficiaryImageAuthorization(org, project), $"autorizacao-de-imagem-{Slug(project.Name)}.pdf");
    }

    /// <summary>Remove os arquivos dos documentos de um voluntario ou projeto que esta sendo excluido.</summary>
    public static async Task<List<string>> StoredNamesAsync(EsfDbContext db, Guid? volunteerId, Guid? projectId) =>
        await db.SignedDocuments
            .Where(d => (volunteerId != null && d.VolunteerId == volunteerId) || (projectId != null && d.ProjectId == projectId))
            .Select(d => d.StoredName)
            .ToListAsync();

    // ---------- internos ----------

    private async Task<SignedDocumentDto> UploadAsync(SignedDocumentKind kind, Guid? volunteerId, Guid? projectId,
        UploadSignedDocumentRequest request)
    {
        var file = request.File ?? throw new AppException("Selecione o arquivo assinado.");
        if (!AllowedExtensions.Contains(Path.GetExtension(file.FileName)))
            throw new AppException("Envie o documento assinado em PDF, JPG ou PNG.");

        var today = Mapping.Today;
        var signedOn = request.SignedOn ?? today;
        if (signedOn > today) throw new AppException("A data da assinatura nao pode estar no futuro.");

        var saved = await _storage.SaveAsync(file, isPrivate: true);
        var document = new SignedDocument
        {
            Kind = kind,
            VolunteerId = volunteerId,
            ProjectId = projectId,
            FileName = saved.OriginalName.Length > 260 ? saved.OriginalName[..260] : saved.OriginalName,
            StoredName = saved.StoredName,
            ContentType = saved.ContentType,
            SizeBytes = saved.Size,
            SignedOn = signedOn,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = _currentUser.Id
        };

        _db.SignedDocuments.Add(document);
        await _db.SaveChangesAsync();

        return (await ToDtos(_db.SignedDocuments.Where(d => d.Id == document.Id))).Single();
    }

    private Task<List<SignedDocumentDto>> ToDtos(IQueryable<SignedDocument> query) =>
        query
            .AsNoTracking()
            .OrderByDescending(d => d.SignedOn)
            .ThenByDescending(d => d.UploadedAt)
            .Select(d => new SignedDocumentDto(
                d.Id,
                d.Kind,
                d.FileName,
                d.SizeBytes,
                d.SignedOn,
                d.UploadedAt,
                _db.Users
                    .Where(u => u.Id == d.UploadedByUserId)
                    .Select(u => u.Volunteer != null ? u.Volunteer.Name : u.Name)
                    .FirstOrDefault()))
            .ToListAsync();

    private async Task<Organization> OrganizationAsync() =>
        await _db.Organizations.AsNoTracking().OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync()
        ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

    /// <summary>"Ana Aumond" -> "ana-aumond" (para o nome do arquivo).</summary>
    private static string Slug(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            builder.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-');
        }
        var slug = string.Join('-', builder.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "documento" : slug;
    }
}
