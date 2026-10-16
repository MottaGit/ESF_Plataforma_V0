using SkiaSharp;

namespace Esf.Api.Reports;

/// <summary>
/// Redimensiona e recomprime fotos antes de embutir no PDF: o relatorio exibe cada foto
/// pequena (poucos centimetros), entao nao faz sentido embutir o arquivo original de
/// varios MB - isso so deixa o PDF pesado sem ganho visual nenhum.
/// </summary>
public static class ReportImageProcessor
{
    private const int MaxDimensionPx = 1200;
    private const int JpegQuality = 75;

    /// <summary>Tenta comprimir; se a imagem nao puder ser decodificada por algum motivo,
    /// devolve os bytes originais em vez de falhar o relatorio inteiro por causa de 1 foto.</summary>
    public static byte[] Compress(byte[] original)
    {
        try
        {
            using var bitmap = SKBitmap.Decode(original);
            if (bitmap is null) return original;

            var longestSide = Math.Max(bitmap.Width, bitmap.Height);

            SKBitmap source = bitmap;
            SKBitmap? resized = null;

            if (longestSide > MaxDimensionPx)
            {
                var scale = (float)MaxDimensionPx / longestSide;
                var targetWidth = Math.Max(1, (int)Math.Round(bitmap.Width * scale));
                var targetHeight = Math.Max(1, (int)Math.Round(bitmap.Height * scale));

                resized = bitmap.Resize(new SKImageInfo(targetWidth, targetHeight), SKFilterQuality.Medium);
                if (resized is not null) source = resized;
            }

            using var image = SKImage.FromBitmap(source);
            using var data = image.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);

            resized?.Dispose();

            return data.ToArray();
        }
        catch
        {
            return original;
        }
    }
}
