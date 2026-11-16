using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Drive;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Configuracoes › Google Drive (so administradores): ligar o nucleo a uma pasta de um Drive compartilhado, ver como
/// anda a rotina e desligar. Ao ligar, os projetos em aberto ganham pasta, com a copia do que ja tem; os encerrados
/// ficam como estao.
/// </summary>
public class DriveSettingsService
{
    private readonly EsfDbContext _db;
    private readonly IDriveClient _drive;
    private readonly ILogger<DriveSettingsService> _logger;

    public DriveSettingsService(EsfDbContext db, IDriveClient drive, ILogger<DriveSettingsService> logger)
    {
        _db = db;
        _drive = drive;
        _logger = logger;
    }

    public async Task<DriveStatusDto> GetAsync()
    {
        var org = await CurrentOrganizationAsync();
        var projects = await _db.DriveItems.CountAsync(i => i.Kind == DriveItemKind.Projeto && i.DriveId != null);
        var pending = await _db.DriveItems.CountAsync(i => i.State == DriveItemState.Pendente || i.State == DriveItemState.Apagar)
                      + await _db.DriveSyncRequests.CountAsync();
        var failed = await _db.DriveItems.CountAsync(i => i.State == DriveItemState.Falhou);
        var lastError = await _db.DriveItems
            .Where(i => i.LastError != null)
            .OrderByDescending(i => i.UpdatedAt)
            .Select(i => i.LastError)
            .FirstOrDefaultAsync();

        return new DriveStatusDto(
            _drive.IsConfigured,
            _drive.AccountEmail,
            org.DriveFolderId is null ? null : org.DriveFolderName,
            org.DriveFolderId is null ? null : DriveNames.FolderUrl(org.DriveFolderId),
            org.DriveConnectedAt,
            org.DriveFolderId is null ? 0 : projects,
            org.DriveFolderId is null ? 0 : pending,
            org.DriveFolderId is null ? 0 : failed,
            org.DriveFolderId is null ? null : lastError);
    }

    /// <summary>
    /// Liga (ou troca) a pasta da plataforma. Confere antes se a conta da plataforma abre a pasta e cria coisas nela.
    /// Trocar de pasta comeca do zero na nova: o que ja foi criado na antiga fica la.
    /// </summary>
    public async Task<DriveStatusDto> ConnectAsync(ConnectDriveRequest request)
    {
        if (!_drive.IsConfigured)
            throw new AppException("A ligação com o Google Drive ainda não foi configurada no servidor.");

        var folderId = DriveNames.FolderIdFrom(request.FolderLink)
                       ?? throw new AppException("Cole o link de uma pasta do Google Drive (drive.google.com/drive/folders/...).");

        DriveFolder? folder;
        try
        {
            folder = await _drive.GetFolderAsync(folderId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google Drive: nao foi possivel abrir a pasta {FolderId}.", folderId);
            throw new AppException("Não foi possível falar com o Google Drive agora. Tente de novo em instantes.");
        }

        if (folder is null)
            throw new AppException($"A plataforma não conseguiu abrir essa pasta. Confira o link e se a conta {_drive.AccountEmail} " +
                                   "foi adicionada ao Drive compartilhado como Gerente de conteúdo.");
        if (!folder.InSharedDrive)
            throw new AppException("A pasta precisa estar num Drive compartilhado: no Meu Drive, a conta da plataforma não consegue guardar arquivos.");
        if (!folder.CanAddChildren)
            throw new AppException($"A conta {_drive.AccountEmail} abre a pasta, mas não pode criar nada nela. No Drive compartilhado, " +
                                   "dê a ela o acesso de Gerente de conteúdo.");

        var org = await CurrentOrganizationAsync();
        if (org.DriveFolderId != folderId) await ForgetAsync();

        org.DriveFolderId = folderId;
        org.DriveFolderName = folder.Name;
        org.DriveConnectedAt = DateTime.UtcNow;

        // Projetos em aberto ganham pasta agora, com a copia das fotos e documentos que ja tem; os encerrados, so se
        // algo precisar dela.
        var open = await _db.Projects
            .Where(p => !p.IsArchived && p.Status != ProjectStatus.Concluido && p.Status != ProjectStatus.Cancelado)
            .Select(p => p.Id)
            .ToListAsync();
        var files = await _db.ProjectFiles.Where(f => open.Contains(f.ProjectId)).OrderBy(f => f.UploadedAt).Select(f => f.Id)
            .ToListAsync();
        _db.DriveSyncRequests.AddRange(open.Select(id => new DriveSyncRequest
            {
                OrganizationId = org.Id, Kind = DriveItemKind.Projeto, EntityId = id
            })
            .Concat(files.Select(id => new DriveSyncRequest
            {
                OrganizationId = org.Id, Kind = DriveItemKind.Arquivo, EntityId = id
            })));

        await _db.SaveChangesAsync();
        return await GetAsync();
    }

    /// <summary>Desliga: a plataforma para de mexer no Drive. As pastas e copias ja criadas ficam la.</summary>
    public async Task DisconnectAsync()
    {
        var org = await CurrentOrganizationAsync();
        org.DriveFolderId = null;
        org.DriveFolderName = null;
        org.DriveConnectedAt = null;
        await ForgetAsync();
        await _db.SaveChangesAsync();
    }

    /// <summary>"Tentar de novo": o que parou ou esta esperando o intervalo volta para a fila agora.</summary>
    public async Task<DriveStatusDto> RetryAsync()
    {
        var waiting = await _db.DriveItems
            .Where(i => i.State == DriveItemState.Falhou || i.NextAttemptAt != null)
            .ToListAsync();
        foreach (var item in waiting)
        {
            if (item.State == DriveItemState.Falhou) item.State = DriveItemState.Pendente;
            item.Attempts = 0;
            item.NextAttemptAt = null;
            item.LastError = null;
            item.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return await GetAsync();
    }

    private async Task ForgetAsync()
    {
        _db.DriveItems.RemoveRange(await _db.DriveItems.ToListAsync());
        _db.DriveSyncRequests.RemoveRange(await _db.DriveSyncRequests.ToListAsync());
    }

    private async Task<Organization> CurrentOrganizationAsync() =>
        await _db.Organizations.FirstOrDefaultAsync() ?? throw AppException.Forbidden("Só quem é de um núcleo pode ligar o Google Drive.");
}
