using Esf.Api.Common;
using Microsoft.Extensions.Options;

namespace Esf.Api.Services;

/// <summary>
/// Armazenamento local em disco. Suficiente para a V0 e facil de trocar depois
/// por um provedor externo (S3, Blob) sem afetar controllers e servicos.
/// </summary>
public class FileStorageService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".txt", ".csv", ".dwg", ".zip"
    };

    private readonly StorageOptions _options;

    public FileStorageService(IWebHostEnvironment env, IOptions<StorageOptions> options)
    {
        _options = options.Value;
        Root = Path.IsPathRooted(_options.UploadsPath)
            ? _options.UploadsPath
            : Path.Combine(env.ContentRootPath, _options.UploadsPath);

        Directory.CreateDirectory(Root);
    }

    public string Root { get; }

    public async Task<(string StoredName, string ContentType, long Size, string OriginalName)> SaveAsync(IFormFile file)
    {
        if (file is null || file.Length == 0)
            throw new AppException("Selecione um arquivo para enviar.");

        var maxBytes = (long)_options.MaxFileSizeMb * 1024 * 1024;
        if (file.Length > maxBytes)
            throw new AppException($"O arquivo excede o limite de {_options.MaxFileSizeMb} MB.");

        var originalName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(originalName);

        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
            throw new AppException("Formato de arquivo nao permitido.");

        var storedName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(Root, storedName);

        await using var stream = new FileStream(fullPath, FileMode.CreateNew);
        await file.CopyToAsync(stream);

        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
        return (storedName, contentType, file.Length, originalName);
    }

    public void Delete(string storedName)
    {
        if (string.IsNullOrWhiteSpace(storedName)) return;

        var fullPath = Path.Combine(Root, Path.GetFileName(storedName));
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }

    public void DeleteMany(IEnumerable<string> storedNames)
    {
        foreach (var name in storedNames) Delete(name);
    }

    public byte[]? TryRead(string storedName)
    {
        try
        {
            var fullPath = Path.Combine(Root, Path.GetFileName(storedName));
            return File.Exists(fullPath) ? File.ReadAllBytes(fullPath) : null;
        }
        catch
        {
            return null;
        }
    }

    public string? FullPathOrNull(string storedName)
    {
        var fullPath = Path.Combine(Root, Path.GetFileName(storedName));
        return File.Exists(fullPath) ? fullPath : null;
    }
}
