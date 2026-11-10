using SkiaSharp;

namespace Esf.Api.Reports;

/// <summary>
/// Prepara as fotos antes de embutir no PDF: endireita pela orientacao da camera (EXIF), corta todas no mesmo
/// formato (4:3, para a grade ficar regular) e reduz e recomprime - o arquivo original de varios MB so deixaria o
/// PDF pesado sem ganho visual nenhum.
/// </summary>
public static class ReportImageProcessor
{
    private const int MaxWidthPx = 1200;
    private const int JpegQuality = 75;

    /// <summary>Formato das fotos no relatorio (largura / altura).</summary>
    private const float AspectRatio = 4f / 3f;

    /// <summary>
    /// Foto em pe cortada para 4:3: guarda a faixa a partir de 35% da sobra (pessoas e rostos costumam ficar na parte
    /// de cima da foto, nao no meio exato).
    /// </summary>
    private const float PortraitAnchor = 0.35f;

    /// <summary>Imagem que o PDF consegue desenhar (o logo enviado pode estar num formato que o Skia nao le).</summary>
    public static bool CanDraw(byte[] data)
    {
        try
        {
            using var codec = SKCodec.Create(new SKMemoryStream(data));
            return codec is not null;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Tenta preparar; se a imagem nao puder ser decodificada por algum motivo,
    /// devolve os bytes originais em vez de falhar o relatorio inteiro por causa de 1 foto.</summary>
    public static byte[] Compress(byte[] original) => Prepare(original) ?? original;

    /// <summary>A versao da foto que vai no PDF (4:3, ate 1200 px, JPEG); null se a imagem nao puder ser lida.</summary>
    public static byte[]? Prepare(byte[] original) =>
        Draw(original, oriented =>
        {
            var crop = CropRect(oriented.Width, oriented.Height);
            var width = Math.Max(1, (int)Math.Min(MaxWidthPx, crop.Width));
            return (crop, width, Math.Max(1, (int)Math.Round(width / AspectRatio)), JpegQuality);
        });

    /// <summary>Miniatura para as listas e a galeria: a foto inteira (sem corte), com o maior lado em maxSide.</summary>
    public static byte[]? Thumbnail(byte[] original, int maxSide = 640) =>
        Draw(original, oriented =>
        {
            var scale = Math.Min(1f, maxSide / (float)Math.Max(oriented.Width, oriented.Height));
            return (SKRect.Create(0, 0, oriented.Width, oriented.Height),
                Math.Max(1, (int)Math.Round(oriented.Width * scale)), Math.Max(1, (int)Math.Round(oriented.Height * scale)), 72);
        });

    /// <summary>Le, endireita pela orientacao da camera e desenha o recorte no tamanho pedido, em JPEG.</summary>
    private static byte[]? Draw(byte[] original, Func<SKBitmap, (SKRect Source, int Width, int Height, int Quality)> layout)
    {
        try
        {
            using var codec = SKCodec.Create(new SKMemoryStream(original));
            if (codec is null) return null;

            using var decoded = SKBitmap.Decode(codec);
            if (decoded is null) return null;

            var oriented = Orient(decoded, codec.EncodedOrigin);
            try
            {
                var (source, width, height, quality) = layout(oriented);

                using var surface = SKSurface.Create(new SKImageInfo(width, height));
                var canvas = surface.Canvas;
                // PNG com transparencia vira JPEG: fundo branco no lugar do transparente.
                canvas.Clear(SKColors.White);
                using var paint = new SKPaint { FilterQuality = SKFilterQuality.Medium, IsAntialias = true };
                canvas.DrawBitmap(oriented, source, new SKRect(0, 0, width, height), paint);

                using var image = surface.Snapshot();
                using var data = image.Encode(SKEncodedImageFormat.Jpeg, quality);
                return data.ToArray();
            }
            finally
            {
                if (!ReferenceEquals(oriented, decoded)) oriented.Dispose();
            }
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Maior retangulo 4:3 dentro da foto: centralizado na largura; na altura, a partir de PortraitAnchor.</summary>
    public static SKRect CropRect(int width, int height)
    {
        if (width >= height * AspectRatio)
        {
            var cropWidth = height * AspectRatio;
            return SKRect.Create((width - cropWidth) / 2, 0, cropWidth, height);
        }

        var cropHeight = width / AspectRatio;
        return SKRect.Create(0, (height - cropHeight) * PortraitAnchor, width, cropHeight);
    }

    /// <summary>
    /// Endireita a foto pela orientacao gravada pela camera (celular em pe grava a imagem deitada e uma marca dizendo
    /// para girar). Cobre os giros de 90, 180 e 270 graus; os espelhamentos (raros) ficam como estao.
    /// </summary>
    private static SKBitmap Orient(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        var degrees = origin switch
        {
            SKEncodedOrigin.RightTop => 90,
            SKEncodedOrigin.BottomRight => 180,
            SKEncodedOrigin.LeftBottom => 270,
            _ => 0
        };
        if (degrees == 0) return bitmap;

        var sideways = degrees != 180;
        var rotated = new SKBitmap(sideways ? bitmap.Height : bitmap.Width, sideways ? bitmap.Width : bitmap.Height);
        using var canvas = new SKCanvas(rotated);
        canvas.Translate(rotated.Width / 2f, rotated.Height / 2f);
        canvas.RotateDegrees(degrees);
        canvas.Translate(-bitmap.Width / 2f, -bitmap.Height / 2f);
        canvas.DrawBitmap(bitmap, 0, 0);
        return rotated;
    }
}
