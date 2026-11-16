using System.Net;
using Esf.Api.Common;
using Google;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;
using Microsoft.Extensions.Options;
using DriveFile = Google.Apis.Drive.v3.Data.File;

namespace Esf.Api.Drive;

/// <summary>
/// Google Drive de verdade, com a conta de servico (GoogleDrive:ServiceAccountJson). A conta de servico nao tem espaco
/// proprio: tudo o que ela cria fica num Drive compartilhado do nucleo, do qual ela e membro (Gerente de conteudo).
/// </summary>
public sealed class GoogleDriveClient : IDriveClient, IDisposable
{
    private const string FolderMimeType = "application/vnd.google-apps.folder";
    private const string TagKey = "esf";

    private readonly DriveService? _service;

    public GoogleDriveClient(IOptions<GoogleDriveOptions> options, ILogger<GoogleDriveClient> logger)
    {
        var json = options.Value.ServiceAccountJson;
        if (string.IsNullOrWhiteSpace(json)) return;

        try
        {
            var account = CredentialFactory.FromJson<ServiceAccountCredential>(json);
            AccountEmail = account.Id;
            _service = new DriveService(new BaseClientService.Initializer
            {
                HttpClientInitializer = account.ToGoogleCredential().CreateScoped(DriveService.Scope.Drive),
                ApplicationName = "ESF Plataforma"
            });
        }
        catch (Exception ex)
        {
            // Chave invalida nao derruba a API: o Drive so fica indisponivel (e o motivo vai para o log).
            logger.LogError(ex, "GoogleDrive:ServiceAccountJson nao e uma chave de conta de servico valida.");
        }
    }

    public bool IsConfigured => _service is not null;

    public string? AccountEmail { get; }

    private DriveService Service =>
        _service ?? throw new InvalidOperationException("Google Drive nao configurado (GoogleDrive:ServiceAccountJson).");

    public async Task<DriveFolder?> GetFolderAsync(string folderId, CancellationToken cancellationToken = default)
    {
        var request = Service.Files.Get(folderId);
        request.SupportsAllDrives = true;
        request.Fields = "id,name,mimeType,trashed,driveId,capabilities(canAddChildren)";
        try
        {
            var file = await request.ExecuteAsync(cancellationToken);
            if (file.MimeType != FolderMimeType || file.Trashed == true) return null;
            return new DriveFolder(file.Id, file.Name, file.Capabilities?.CanAddChildren == true, file.DriveId is not null);
        }
        catch (GoogleApiException ex) when (IsMissing(ex))
        {
            return null;
        }
    }

    public async Task<string?> FindByTagAsync(string parentId, string tag, CancellationToken cancellationToken = default)
    {
        var request = Service.Files.List();
        request.Q = $"'{Escape(parentId)}' in parents and trashed = false " +
                    $"and appProperties has {{ key='{TagKey}' and value='{Escape(tag)}' }}";
        request.SupportsAllDrives = true;
        request.IncludeItemsFromAllDrives = true;
        request.Corpora = "allDrives";
        request.Fields = "files(id)";
        request.PageSize = 1;
        try
        {
            var result = await request.ExecuteAsync(cancellationToken);
            return result.Files?.FirstOrDefault()?.Id;
        }
        catch (GoogleApiException ex) when (IsMissing(ex))
        {
            throw new DriveItemMissingException($"A pasta {parentId} nao foi encontrada no Drive.", ex);
        }
    }

    public async Task<string> CreateFolderAsync(string parentId, string name, string tag,
        CancellationToken cancellationToken = default)
    {
        var request = Service.Files.Create(new DriveFile
        {
            Name = name,
            MimeType = FolderMimeType,
            Parents = new[] { parentId },
            AppProperties = new Dictionary<string, string> { [TagKey] = tag }
        });
        request.SupportsAllDrives = true;
        request.Fields = "id";
        try
        {
            return (await request.ExecuteAsync(cancellationToken)).Id;
        }
        catch (GoogleApiException ex) when (IsMissing(ex))
        {
            throw new DriveItemMissingException($"A pasta {parentId} nao foi encontrada no Drive.", ex);
        }
    }

    public async Task<string> UploadAsync(string parentId, string name, string contentType, byte[] content, string tag,
        CancellationToken cancellationToken = default)
    {
        using var stream = new MemoryStream(content);
        var request = Service.Files.Create(new DriveFile
        {
            Name = name,
            Parents = new[] { parentId },
            AppProperties = new Dictionary<string, string> { [TagKey] = tag }
        }, stream, contentType);
        request.SupportsAllDrives = true;
        request.Fields = "id";

        var progress = await request.UploadAsync(cancellationToken);
        if (progress.Status != UploadStatus.Completed)
        {
            if (progress.Exception is GoogleApiException ex && IsMissing(ex))
                throw new DriveItemMissingException($"A pasta {parentId} nao foi encontrada no Drive.", ex);
            throw progress.Exception ?? new InvalidOperationException("O envio ao Drive nao terminou.");
        }

        return request.ResponseBody.Id;
    }

    public async Task UpdateAsync(string id, string? newName, string? oldParentId, string? newParentId,
        CancellationToken cancellationToken = default)
    {
        var request = Service.Files.Update(new DriveFile { Name = newName }, id);
        request.SupportsAllDrives = true;
        request.Fields = "id";
        if (newParentId is not null && newParentId != oldParentId)
        {
            request.AddParents = newParentId;
            if (oldParentId is not null) request.RemoveParents = oldParentId;
        }

        try
        {
            await request.ExecuteAsync(cancellationToken);
        }
        catch (GoogleApiException ex) when (IsMissing(ex))
        {
            throw new DriveItemMissingException($"O item {id} nao foi encontrado no Drive.", ex);
        }
    }

    public async Task TrashAsync(string id, CancellationToken cancellationToken = default)
    {
        var request = Service.Files.Update(new DriveFile { Trashed = true }, id);
        request.SupportsAllDrives = true;
        request.Fields = "id";
        try
        {
            await request.ExecuteAsync(cancellationToken);
        }
        catch (GoogleApiException ex) when (IsMissing(ex))
        {
            // Ja apagado por alguem direto no Drive: nada a fazer.
        }
    }

    private static bool IsMissing(GoogleApiException ex) => ex.HttpStatusCode == HttpStatusCode.NotFound;

    private static string Escape(string value) => value.Replace("\\", "\\\\").Replace("'", "\\'");

    public void Dispose() => _service?.Dispose();
}
