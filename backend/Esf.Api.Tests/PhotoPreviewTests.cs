using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace Esf.Api.Tests;

/// <summary>Miniatura e versao do PDF de cada foto, feitas em segundo plano depois do envio.</summary>
public class PhotoPreviewTests
{
    /// <summary>Uma foto de verdade (JPEG), do tamanho que o celular envia depois de reduzir.</summary>
    internal static byte[] Photo(int width = 2048, int height = 1536)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        using (var paint = new SKPaint())
        {
            paint.Shader = SKShader.CreateLinearGradient(new SKPoint(0, 0), new SKPoint(width, height),
                new[] { SKColors.SeaGreen, SKColors.SandyBrown }, SKShaderTileMode.Clamp);
            canvas.DrawRect(0, 0, width, height, paint);
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 85);
        return data.ToArray();
    }

    private static async Task<ProjectFile> AddPhotoAsync(TwoNucleos f, string storedName, byte[] content, Guid? updateId = null)
    {
        await using var system = f.SystemContext();
        system.StoredFiles.Add(new StoredFile { StoredName = storedName, ContentType = "image/jpeg", SizeBytes = content.Length, Content = content });
        var file = new ProjectFile
        {
            ProjectId = f.A.ProjectId, ProjectUpdateId = updateId, FileName = "foto.jpg", StoredName = storedName,
            ContentType = "image/jpeg", SizeBytes = content.Length,
            PreviewState = ImagePreviews.Supports("image/jpeg", storedName) ? PreviewState.Pending : PreviewState.None
        };
        system.ProjectFiles.Add(file);
        await system.SaveChangesAsync();
        return file;
    }

    [Fact]
    public async Task PhotoGetsThumbnailAndReportVersionInTheBackground()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        var worker = services.GetRequiredService<JobWorker>();

        var file = await AddPhotoAsync(f, "obra.jpg", Photo());
        Assert.Null(Mapping.ToDto(file).ThumbnailUrl);

        Assert.True(await worker.ProcessNextPreviewAsync());
        Assert.False(await worker.ProcessNextPreviewAsync());

        await using var check = f.SystemContext();
        var ready = await check.ProjectFiles.SingleAsync(x => x.Id == file.Id);
        Assert.Equal(PreviewState.Ready, ready.PreviewState);
        Assert.Equal("/uploads/obra.t.jpg", Mapping.ToDto(ready).ThumbnailUrl);

        // Miniatura: a foto inteira com o maior lado em 640; publica como a original.
        var thumbnail = await check.StoredFiles.SingleAsync(s => s.StoredName == "obra.t.jpg");
        Assert.False(thumbnail.IsPrivate);
        using (var bitmap = SKBitmap.Decode(thumbnail.Content))
            Assert.Equal((640, 480), (bitmap.Width, bitmap.Height));

        // Versao do PDF: 4:3, ate 1200 px (a mesma que o relatorio faria na hora).
        var report = await check.StoredFiles.SingleAsync(s => s.StoredName == "obra.r.jpg");
        using (var bitmap = SKBitmap.Decode(report.Content))
            Assert.Equal((1200, 900), (bitmap.Width, bitmap.Height));
    }

    [Fact]
    public async Task UnreadableImageKeepsTheOriginal()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);

        var file = await AddPhotoAsync(f, "quebrada.jpg", new byte[] { 1, 2, 3, 4 });
        Assert.True(await services.GetRequiredService<JobWorker>().ProcessNextPreviewAsync());

        await using var check = f.SystemContext();
        var failed = await check.ProjectFiles.SingleAsync(x => x.Id == file.Id);
        Assert.Equal(PreviewState.Failed, failed.PreviewState);
        Assert.Null(Mapping.ToDto(failed).ThumbnailUrl);
        Assert.False(await check.StoredFiles.AnyAsync(s => s.StoredName.StartsWith("quebrada.")
                                                           && s.StoredName != "quebrada.jpg"));
    }

    [Fact]
    public void OnlyPhotosInCommonFormatsGetVersions()
    {
        Assert.True(ImagePreviews.Supports("image/png", "foto.PNG"));
        Assert.True(ImagePreviews.Supports("image/webp", "foto.webp"));
        Assert.False(ImagePreviews.Supports("image/gif", "animada.gif"));
        Assert.False(ImagePreviews.Supports("image/heic", "iphone.heic"));
        Assert.False(ImagePreviews.Supports("application/pdf", "termo.pdf"));
    }

    [Fact]
    public async Task ReportUsesTheVersionMadeAtUpload()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);

        var update = new ProjectUpdate { ProjectId = f.A.ProjectId, Text = "<p>Obra</p>", AuthorUserId = f.A.AdminUserId };
        await using (var system = f.SystemContext())
        {
            system.ProjectUpdates.Add(update);
            await system.SaveChangesAsync();
        }
        await AddPhotoAsync(f, "registro.jpg", Photo(), update.Id);
        await services.GetRequiredService<JobWorker>().ProcessNextPreviewAsync();

        // Sem a original, a foto so pode ter entrado no PDF pela versao pronta.
        await using (var system = f.SystemContext())
        {
            system.StoredFiles.Remove(await system.StoredFiles.SingleAsync(s => s.StoredName == "registro.jpg"));
            await system.SaveChangesAsync();
        }

        async Task<int> PdfSizeAsync(bool photos)
        {
            using var scope = services.As(f.A.Admin);
            var reports = scope.ServiceProvider.GetRequiredService<ReportService>();
            var request = new ReportRequest { ProjectIds = { f.A.ProjectId }, IncludePhotos = photos };
            return (await reports.GenerateAsync(request, "Admin")).Content.Length;
        }

        Assert.True(await PdfSizeAsync(photos: true) > await PdfSizeAsync(photos: false) + 10_000);
    }

    [PostgresFact]
    public async Task DeletingAPhotoDeletesItsVersions()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var services = JobServices.Create(f.Options);
        await AddPhotoAsync(f, "apagar.jpg", Photo());
        await services.GetRequiredService<JobWorker>().ProcessNextPreviewAsync();

        using (var scope = services.As(f.A.Admin))
            await scope.ServiceProvider.GetRequiredService<FileStorageService>().DeleteAsync("apagar.jpg");

        await using var check = f.SystemContext();
        Assert.False(await check.StoredFiles.AnyAsync(s => s.StoredName.StartsWith("apagar.")));
    }
}
