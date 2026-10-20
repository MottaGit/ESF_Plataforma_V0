using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Services;

/// <summary>
/// Arquivos enviados (fotos, documentos, logo) guardados no proprio banco, na tabela StoredFiles. O disco
/// do servidor e recriado a cada deploy, entao o que era gravado nele se perdia enquanto os registros
/// continuavam no banco. Os enderecos publicos continuam sendo /uploads/{nome}.
/// </summary>
public class FileStorageService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".txt", ".csv", ".dwg", ".zip"
    };

    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    private readonly EsfDbContext _db;
    private readonly StorageOptions _options;

    public FileStorageService(EsfDbContext db, IOptions<StorageOptions> options)
    {
        _db = db;
        _options = options.Value;
    }

    /// <summary>
    /// Valida o arquivo e o registra no contexto. Ele e gravado no SaveChanges de quem chamou, junto com o
    /// registro que aponta para ele: os dois entram (ou nao) juntos.
    /// </summary>
    /// <param name="isPrivate">Documentos assinados: nao saem por /uploads, so pelo download com login.</param>
    public async Task<(string StoredName, string ContentType, long Size, string OriginalName)> SaveAsync(IFormFile file,
        bool isPrivate = false)
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
        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? ContentTypeFor(storedName) : file.ContentType;

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer);

        _db.StoredFiles.Add(new StoredFile
        {
            StoredName = storedName,
            ContentType = contentType,
            SizeBytes = buffer.Length,
            Content = buffer.ToArray(),
            IsPrivate = isPrivate,
            CreatedAt = DateTime.UtcNow
        });

        return (storedName, contentType, buffer.Length, originalName);
    }

    /// <summary>Apaga na hora (sem esperar um SaveChanges): usado depois que o registro dono ja saiu.</summary>
    public Task DeleteAsync(string? storedName) =>
        string.IsNullOrWhiteSpace(storedName) ? Task.CompletedTask : DeleteManyAsync(new[] { storedName });

    public async Task DeleteManyAsync(IEnumerable<string> storedNames)
    {
        var names = storedNames
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => Path.GetFileName(name))
            .Distinct()
            .ToList();
        if (names.Count == 0) return;

        await _db.StoredFiles.Where(f => names.Contains(f.StoredName)).ExecuteDeleteAsync();
    }

    public async Task<byte[]?> TryReadAsync(string storedName)
    {
        var name = Path.GetFileName(storedName);
        return await _db.StoredFiles.AsNoTracking()
            .Where(f => f.StoredName == name)
            .Select(f => f.Content)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Conteudo para servir em /uploads/{nome}. O tipo vem da extensao do nome gerado (nunca do que o
    /// navegador declarou no envio), entao um arquivo nao consegue se passar por pagina HTML.
    /// </summary>
    public async Task<(byte[] Content, string ContentType)?> FindAsync(string storedName)
    {
        var name = Path.GetFileName(storedName);
        var content = await _db.StoredFiles.AsNoTracking()
            .Where(f => f.StoredName == name && !f.IsPrivate)
            .Select(f => f.Content)
            .FirstOrDefaultAsync();
        return content is null ? null : (content, ContentTypeFor(storedName));
    }

    public static string ContentTypeFor(string fileName) =>
        ContentTypes.TryGetContentType(fileName, out var type) ? type : "application/octet-stream";

    /// <summary>
    /// Copia para o banco os arquivos de versoes anteriores que ainda estao na pasta de uploads (por exemplo,
    /// no docker compose, que tem volume). Considera so os arquivos referenciados por algum registro.
    /// </summary>
    public async Task<int> ImportLegacyFilesAsync(string contentRoot)
    {
        var root = Path.IsPathRooted(_options.UploadsPath)
            ? _options.UploadsPath
            : Path.Combine(contentRoot, _options.UploadsPath);
        if (!Directory.Exists(root)) return 0;

        var referenced = new HashSet<string>(StringComparer.Ordinal);
        referenced.UnionWith(await _db.ProjectFiles.Select(f => f.StoredName).ToListAsync());
        referenced.UnionWith(await _db.Volunteers.Where(v => v.PhotoStoredName != null).Select(v => v.PhotoStoredName!).ToListAsync());
        referenced.UnionWith((await _db.Organizations.Where(o => o.LogoUrl != null).Select(o => o.LogoUrl!).ToListAsync())
            .Select(url => url.Split('/').Last()));

        var alreadyStored = (await _db.StoredFiles.Select(f => f.StoredName).ToListAsync()).ToHashSet(StringComparer.Ordinal);

        var imported = 0;
        foreach (var name in referenced.Where(name => !alreadyStored.Contains(name)))
        {
            var path = Path.Combine(root, Path.GetFileName(name));
            if (!File.Exists(path)) continue;

            var content = await File.ReadAllBytesAsync(path);
            _db.StoredFiles.Add(new StoredFile
            {
                StoredName = name,
                ContentType = ContentTypeFor(name),
                SizeBytes = content.Length,
                Content = content,
                CreatedAt = File.GetLastWriteTimeUtc(path)
            });

            // Um por vez, para nao segurar todos os arquivos em memoria.
            await _db.SaveChangesAsync();
            _db.ChangeTracker.Clear();
            imported++;
        }

        return imported;
    }
}
