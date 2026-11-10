namespace Esf.Api.Reports;

/// <summary>
/// Versoes de cada foto enviada, geradas em segundo plano pelo JobWorker logo depois do envio: a miniatura (listas e
/// galeria, bem mais leve no celular) e a versao do PDF (a mesma de ReportImageProcessor.Prepare, para o relatorio
/// nao reduzir centenas de fotos na hora). Ficam em StoredFiles com o nome da original mais ".t.jpg" e ".r.jpg", e
/// saem junto com ela (FileStorageService.DeleteManyAsync).
/// </summary>
public static class ImagePreviews
{
    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

    /// <summary>Formatos que ganham as versoes (GIF perderia a animacao; HEIC o servidor nao le).</summary>
    public static bool Supports(string contentType, string storedName) =>
        contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) && Extensions.Contains(Path.GetExtension(storedName));

    public static string ThumbnailName(string storedName) => $"{Path.GetFileNameWithoutExtension(storedName)}.t.jpg";

    public static string ReportName(string storedName) => $"{Path.GetFileNameWithoutExtension(storedName)}.r.jpg";

    /// <summary>Os nomes das versoes de um arquivo (para apagar junto).</summary>
    public static IEnumerable<string> Variants(string storedName) => new[] { ThumbnailName(storedName), ReportName(storedName) };

    /// <summary>Miniatura e versao do PDF; null se a imagem nao puder ser lida.</summary>
    public static (byte[] Thumbnail, byte[] Report)? Create(byte[] original)
    {
        var thumbnail = ReportImageProcessor.Thumbnail(original);
        if (thumbnail is null) return null;
        var report = ReportImageProcessor.Prepare(original);
        return report is null ? null : (thumbnail, report);
    }
}
