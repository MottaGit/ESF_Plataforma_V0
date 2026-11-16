using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Drive;
using Esf.Api.Dtos;
using Google;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Rotina do Google Drive (mao unica, plataforma → Drive). Cada passo transforma os avisos gravados no SaveChanges
/// (DriveSyncRequest) em itens pendentes (DriveItem) e acerta um item no Drive: cria a pasta, renomeia, move, copia a
/// foto ou o documento, manda para a lixeira o que foi apagado na plataforma. Falha
/// (Google fora do ar, acesso tirado) so adia o item, com intervalo crescente; a plataforma segue normal.
/// Roda num escopo proprio, vendo todos os nucleos (DriveSyncWorker; nos testes, chamada direto).
/// </summary>
public class DriveSyncService
{
    /// <summary>Tentativas antes de o item parar e esperar o "Tentar de novo" de Configuracoes.</summary>
    public const int MaxAttempts = 8;

    private static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    /// <summary>
    /// O relatorio final espera um pouco depois da conclusao: o registro de encerramento e os numeros finais chegam logo
    /// depois de mudar o status.
    /// </summary>
    public static readonly TimeSpan FinalReportDelay = TimeSpan.FromMinutes(2);

    /// <summary>Quem aparece como autor no relatorio final.</summary>
    public const string FinalReportAuthor = "Plataforma ESF, ao concluir o projeto";

    private readonly EsfDbContext _db;
    private readonly IDriveClient _drive;
    private readonly FileStorageService _storage;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<DriveSyncService> _logger;

    public DriveSyncService(EsfDbContext db, IDriveClient drive, FileStorageService storage, IServiceScopeFactory scopes,
        ILogger<DriveSyncService> logger)
    {
        _db = db;
        _db.AllOrganizations = true;
        _drive = drive;
        _storage = storage;
        _scopes = scopes;
        _logger = logger;
    }

    /// <summary>Projeto que ganha pasta sozinho (ao ligar o Drive ou ao ser criado): em aberto e nao arquivado.</summary>
    public static bool IsOpen(Project project) =>
        !project.IsArchived && project.Status is not (ProjectStatus.Concluido or ProjectStatus.Cancelado);

    /// <summary>Um passo da rotina. Falso quando nao ha nada a fazer (a rotina espera um pouco).</summary>
    public async Task<bool> ProcessNextAsync(CancellationToken cancellationToken = default)
    {
        var drained = await DrainRequestsAsync(cancellationToken);
        var item = await ClaimAsync(cancellationToken);
        if (item is null) return drained;

        await RunAsync(item, cancellationToken);
        return true;
    }

    /// <summary>Roda ate acabar o que da para fazer agora (testes e "Tentar de novo").</summary>
    public async Task RunUntilIdleAsync(CancellationToken cancellationToken = default)
    {
        while (await ProcessNextAsync(cancellationToken))
        {
        }
    }

    /// <summary>Avisos viram itens pendentes; os de nucleo sem Drive ligado so somem.</summary>
    private async Task<bool> DrainRequestsAsync(CancellationToken cancellationToken)
    {
        var requests = await _db.DriveSyncRequests.OrderBy(r => r.CreatedAt).Take(200).ToListAsync(cancellationToken);
        if (requests.Count == 0) return false;

        var organizationIds = requests.Select(r => r.OrganizationId).Distinct().ToList();
        var connected = (await _db.Organizations
                .Where(o => organizationIds.Contains(o.Id) && o.DriveFolderId != null)
                .Select(o => o.Id)
                .ToListAsync(cancellationToken))
            .ToHashSet();
        var entityIds = requests.Where(r => connected.Contains(r.OrganizationId)).Select(r => r.EntityId).Distinct().ToList();
        var items = await _db.DriveItems.Where(i => entityIds.Contains(i.EntityId)).ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var request in requests)
        {
            _db.DriveSyncRequests.Remove(request);
            if (!connected.Contains(request.OrganizationId)) continue;

            var item = items.FirstOrDefault(i => i.Kind == request.Kind && i.EntityId == request.EntityId && i.Key == request.Key);
            if (item is null)
            {
                // Apagado antes de chegar ao Drive: nada a fazer.
                if (request.Delete) continue;
                item = new DriveItem
                {
                    OrganizationId = request.OrganizationId, Kind = request.Kind, EntityId = request.EntityId, Key = request.Key
                };
                _db.DriveItems.Add(item);
                items.Add(item);
            }

            // Apagar vale mais que qualquer aviso anterior ou seguinte.
            item.State = request.Delete || item.State == DriveItemState.Apagar ? DriveItemState.Apagar : DriveItemState.Pendente;
            item.Attempts = 0;
            item.NextAttemptAt = request.Kind == DriveItemKind.RelatorioFinal ? now + FinalReportDelay : null;
            item.LastError = null;
            item.Stamp = Guid.NewGuid();
            item.UpdatedAt = now;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            // Outro servidor pegou os mesmos avisos ao mesmo tempo: o que sobrou fica para o proximo passo.
            _logger.LogInformation(ex, "Avisos do Drive ja tratados por outra rotina.");
            _db.ChangeTracker.Clear();
        }

        return true;
    }

    private async Task<DriveItem?> ClaimAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var item = await _db.DriveItems
            .Where(i => (i.State == DriveItemState.Pendente || i.State == DriveItemState.Apagar)
                        && (i.NextAttemptAt == null || i.NextAttemptAt <= now)
                        && (i.LeaseUntil == null || i.LeaseUntil < now))
            // Pais antes dos filhos (programa, projeto, ...).
            .OrderBy(i => i.Kind).ThenBy(i => i.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (item is null) return null;

        item.LeaseUntil = now + Lease;
        item.Stamp = Guid.NewGuid();
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return item;
        }
        catch (DbUpdateConcurrencyException)
        {
            _db.ChangeTracker.Clear();
            return null;
        }
    }

    private async Task RunAsync(DriveItem item, CancellationToken cancellationToken)
    {
        var root = await _db.Organizations.AsNoTracking()
            .Where(o => o.Id == item.OrganizationId)
            .Select(o => o.DriveFolderId)
            .FirstOrDefaultAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var keep = true;
        try
        {
            // Drive desligado depois do aviso: o item perde o sentido.
            keep = root is not null && (item.State == DriveItemState.Apagar
                ? await TrashAsync(item, cancellationToken)
                : await ApplyAsync(root, item, cancellationToken));
            item.State = DriveItemState.EmDia;
            item.Attempts = 0;
            item.NextAttemptAt = null;
            item.LastError = null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            item.Attempts++;
            item.LastError = Describe(ex);
            item.NextAttemptAt = now + Backoff(item.Attempts);
            // Apagar nunca desiste (so espera mais); o resto para depois de muitas tentativas.
            if (item.State != DriveItemState.Apagar && item.Attempts >= MaxAttempts) item.State = DriveItemState.Falhou;
            _logger.LogWarning(ex, "Google Drive: falha no item {Kind} {EntityId} (tentativa {Attempts}).",
                item.Kind, item.EntityId, item.Attempts);
        }

        item.LeaseUntil = null;
        item.UpdatedAt = now;
        if (!keep) _db.DriveItems.Remove(item);
        await SaveItemAsync(item, cancellationToken);
    }

    /// <summary>
    /// Grava o resultado. Se chegou um aviso novo enquanto o item era processado (outro servidor), guarda o que foi
    /// criado no Drive e deixa o item pendente para a proxima vez.
    /// </summary>
    private async Task SaveItemAsync(DriveItem item, CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            _db.ChangeTracker.Clear();
            var current = await _db.DriveItems.FirstOrDefaultAsync(i => i.Id == item.Id, cancellationToken);
            if (current is null) return;
            current.DriveId = item.DriveId;
            current.ParentDriveId = item.ParentDriveId;
            current.Name = item.Name;
            current.PhotosFolderId = item.PhotosFolderId;
            current.OtherPhotosFolderId = item.OtherPhotosFolderId;
            current.DocumentsFolderId = item.DocumentsFolderId;
            current.LeaseUntil = null;
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>Acerta o item no Drive. Falso quando ele nao precisa (mais) existir: a linha some.</summary>
    private Task<bool> ApplyAsync(string root, DriveItem item, CancellationToken cancellationToken) => item.Kind switch
    {
        DriveItemKind.Programa => SyncProgramAsync(root, item, cancellationToken),
        DriveItemKind.Projeto => SyncProjectAsync(root, item, cancellationToken),
        DriveItemKind.Registro => SyncRecordAsync(root, item, cancellationToken),
        DriveItemKind.Arquivo => SyncFileAsync(root, item, cancellationToken),
        DriveItemKind.RelatorioFinal => SyncFinalReportAsync(root, item, cancellationToken),
        _ => Task.FromResult(false)
    };

    private async Task<bool> TrashAsync(DriveItem item, CancellationToken cancellationToken)
    {
        if (item.DriveId is not null) await _drive.TrashAsync(item.DriveId, cancellationToken);
        return false;
    }

    // ---------- programas e projetos ----------

    /// <summary>
    /// Pasta do programa. Ainda sem pasta, so a ganha o programa ativo que e novo (sem projetos) ou tem projeto em
    /// aberto; o resto ganha quando um projeto precisar. Programa excluido: a pasta fica no Drive.
    /// </summary>
    private async Task<bool> SyncProgramAsync(string root, DriveItem item, CancellationToken cancellationToken)
    {
        var program = await _db.Programs.AsNoTracking().FirstOrDefaultAsync(p => p.Id == item.EntityId, cancellationToken);
        if (program is null) return false;

        if (item.DriveId is null)
        {
            var projects = await _db.Projects.AsNoTracking().Where(p => p.ProgramId == program.Id).ToListAsync(cancellationToken);
            if (program.Status != ProgramStatus.Ativo || (projects.Count > 0 && !projects.Any(IsOpen))) return false;
        }

        await EnsureFolderAsync(item, root, DriveNames.Clean(program.Name), DriveNames.ProgramTag(program.Id), cancellationToken);
        return true;
    }

    /// <summary>
    /// Pasta do projeto (dentro da do programa) com as subpastas fixas. Ainda sem pasta, so a ganha o projeto em
    /// aberto; o encerrado ganha quando algo precisar dela. Projeto excluido: a pasta fica no Drive.
    /// </summary>
    private async Task<bool> SyncProjectAsync(string root, DriveItem item, CancellationToken cancellationToken)
    {
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == item.EntityId, cancellationToken);
        if (project is null) return false;
        if (item.DriveId is null && !IsOpen(project)) return false;

        await EnsureProjectFolderAsync(root, item, project, cancellationToken);
        return true;
    }

    /// <summary>A pasta do projeto e as subpastas existem, com o nome e no programa de agora.</summary>
    private async Task EnsureProjectFolderAsync(string root, DriveItem item, Project project, CancellationToken cancellationToken)
    {
        var programFolder = await ProgramFolderAsync(root, project.ProgramId, project.OrganizationId, cancellationToken);
        var before = item.DriveId;
        try
        {
            await EnsureFolderAsync(item, programFolder, DriveNames.Clean(project.Name), DriveNames.ProjectTag(project.Id),
                cancellationToken);
        }
        catch (DriveItemMissingException)
        {
            // A pasta do programa foi apagada de vez no Drive: cria de novo e tenta mais uma vez.
            programFolder = await ProgramFolderAsync(root, project.ProgramId, project.OrganizationId, cancellationToken,
                recreate: true);
            await EnsureFolderAsync(item, programFolder, DriveNames.Clean(project.Name), DriveNames.ProjectTag(project.Id),
                cancellationToken);
        }

        if (before != item.DriveId)
        {
            item.PhotosFolderId = null;
            item.OtherPhotosFolderId = null;
            item.DocumentsFolderId = null;
        }

        if (item.PhotosFolderId is not null && item.OtherPhotosFolderId is not null && item.DocumentsFolderId is not null)
            return;

        foreach (var subfolder in DriveNames.ProjectSubfolders)
        {
            var id = await FindOrCreateFolderAsync(item.DriveId!, subfolder.Name,
                DriveNames.SubfolderTag(project.Id, subfolder), cancellationToken);
            if (subfolder == DriveNames.PhotosFolder) item.PhotosFolderId = id;
            if (subfolder == DriveNames.DocumentsFolder) item.DocumentsFolderId = id;
        }

        item.OtherPhotosFolderId = await FindOrCreateFolderAsync(item.PhotosFolderId!, DriveNames.OtherPhotos,
            DriveNames.SubfolderTag(project.Id, DriveNames.OtherPhotosFolder), cancellationToken);
    }

    /// <summary>
    /// O item da pasta do projeto, com a pasta e as subpastas prontas, criando se preciso (uma copia ou o relatorio
    /// final precisa dela, mesmo com o projeto encerrado).
    /// </summary>
    private async Task<DriveItem> ProjectItemAsync(string root, Project project, CancellationToken cancellationToken)
    {
        var item = await FindItemAsync(DriveItemKind.Projeto, project.Id, cancellationToken);
        var isNew = item is null;
        item ??= new DriveItem
        {
            OrganizationId = project.OrganizationId, Kind = DriveItemKind.Projeto, EntityId = project.Id, State = DriveItemState.EmDia
        };

        if (item.DriveId is null || item.PhotosFolderId is null || item.OtherPhotosFolderId is null || item.DocumentsFolderId is null)
            await EnsureProjectFolderAsync(root, item, project, cancellationToken);

        if (isNew) _db.DriveItems.Add(item);
        return item;
    }

    private Task<DriveItem?> FindItemAsync(DriveItemKind kind, Guid entityId, CancellationToken cancellationToken) =>
        _db.DriveItems.FirstOrDefaultAsync(i => i.Kind == kind && i.EntityId == entityId && i.Key == "", cancellationToken);

    /// <summary>
    /// Alguma pasta do projeto sumiu do Drive (apagada de vez): esquece as pastas do projeto e dos registros dele, para a
    /// proxima tentativa recriar.
    /// </summary>
    private async Task ForgetProjectFoldersAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await FindItemAsync(DriveItemKind.Projeto, projectId, cancellationToken);
        if (project is not null)
        {
            project.DriveId = null;
            project.PhotosFolderId = null;
            project.OtherPhotosFolderId = null;
            project.DocumentsFolderId = null;
        }

        var records = await _db.ProjectUpdates.AsNoTracking().Where(u => u.ProjectId == projectId).Select(u => u.Id)
            .ToListAsync(cancellationToken);
        foreach (var record in await _db.DriveItems
                     .Where(i => i.Kind == DriveItemKind.Registro && records.Contains(i.EntityId))
                     .ToListAsync(cancellationToken))
            record.DriveId = null;
    }

    // ---------- registros e arquivos ----------

    private static bool IsPhoto(ProjectFile file) => file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Pasta do registro de andamento: so existe enquanto o registro tem tipo e fotos ("AAAA-MM-DD – Tipo", dentro de
    /// "04. Fotos e vídeos"). Junto, as fotos do registro vao para o lugar certo: para a pasta dele, ou para "Outras
    /// fotos" quando ele perde o tipo (e a pasta, vazia, vai para a lixeira).
    /// </summary>
    private async Task<bool> SyncRecordAsync(string root, DriveItem item, CancellationToken cancellationToken)
    {
        var record = await _db.ProjectUpdates.AsNoTracking().Include(u => u.Attachments)
            .FirstOrDefaultAsync(u => u.Id == item.EntityId, cancellationToken);
        if (record is null) return await TrashAsync(item, cancellationToken);

        var photos = record.Attachments.Where(IsPhoto).OrderBy(f => f.UploadedAt).ToList();
        foreach (var photo in photos)
        {
            var fileItem = await FindItemAsync(DriveItemKind.Arquivo, photo.Id, cancellationToken);
            var isNew = fileItem is null;
            fileItem ??= new DriveItem
            {
                OrganizationId = item.OrganizationId, Kind = DriveItemKind.Arquivo, EntityId = photo.Id, State = DriveItemState.EmDia
            };
            await CopyFileAsync(root, fileItem, photo, cancellationToken);
            if (isNew && fileItem.DriveId is not null) _db.DriveItems.Add(fileItem);
        }

        // Sem tipo ou sem fotos: as fotos ja sairam da pasta, que vai para a lixeira.
        if (record.Kind is null || photos.Count == 0)
        {
            if (item.DriveId is not null) await _drive.TrashAsync(item.DriveId, cancellationToken);
            return false;
        }

        // Com fotos, a copia de cada uma ja criou ou acertou a pasta (neste mesmo item, rastreado no contexto).
        return true;
    }

    /// <summary>Copia da foto ou do documento, no lugar que a regra manda (ver FileParentAsync). Apagado: some.</summary>
    private async Task<bool> SyncFileAsync(string root, DriveItem item, CancellationToken cancellationToken)
    {
        var file = await _db.ProjectFiles.AsNoTracking().FirstOrDefaultAsync(f => f.Id == item.EntityId, cancellationToken);
        if (file is null) return await TrashAsync(item, cancellationToken);

        await CopyFileAsync(root, item, file, cancellationToken);
        return item.DriveId is not null;
    }

    private async Task CopyFileAsync(string root, DriveItem item, ProjectFile file, CancellationToken cancellationToken)
    {
        try
        {
            await PlaceFileAsync(root, item, file, cancellationToken);
        }
        catch (DriveItemMissingException)
        {
            // Uma pasta do projeto foi apagada de vez no Drive: recria as pastas e tenta mais uma vez.
            await ForgetProjectFoldersAsync(file.ProjectId, cancellationToken);
            await PlaceFileAsync(root, item, file, cancellationToken);
        }
    }

    private async Task PlaceFileAsync(string root, DriveItem item, ProjectFile file, CancellationToken cancellationToken)
    {
        var parent = await FileParentAsync(root, file, cancellationToken);
        if (item.DriveId is not null)
        {
            if (item.ParentDriveId == parent) return;
            try
            {
                await _drive.UpdateAsync(item.DriveId, null, item.ParentDriveId, parent, cancellationToken);
                item.ParentDriveId = parent;
                return;
            }
            catch (DriveItemMissingException)
            {
                // A copia foi apagada de vez no Drive: envia de novo.
                item.DriveId = null;
            }
        }

        var name = DriveNames.Clean(file.FileName);
        var tag = DriveNames.FileTag(file.Id);
        item.DriveId = await _drive.FindByTagAsync(parent, tag, cancellationToken);
        if (item.DriveId is null)
        {
            // Sem o conteudo (apagado logo depois do envio), nao ha o que copiar.
            var content = await _storage.TryReadAsync(file.StoredName);
            if (content is null) return;
            item.DriveId = await _drive.UploadAsync(parent, name, file.ContentType, content, tag, cancellationToken);
        }

        item.ParentDriveId = parent;
        item.Name = name;
    }

    /// <summary>
    /// Onde fica a copia: documento em "05. Documentos"; foto de registro com tipo na pasta do registro; as outras
    /// fotos (registro sem tipo, tarefa, aba Arquivos) em "Outras fotos".
    /// </summary>
    private async Task<string> FileParentAsync(string root, ProjectFile file, CancellationToken cancellationToken)
    {
        var project = await _db.Projects.AsNoTracking().FirstAsync(p => p.Id == file.ProjectId, cancellationToken);
        var projectItem = await ProjectItemAsync(root, project, cancellationToken);
        if (!IsPhoto(file)) return projectItem.DocumentsFolderId!;
        if (file.ProjectUpdateId is not { } recordId) return projectItem.OtherPhotosFolderId!;

        var record = await _db.ProjectUpdates.AsNoTracking().FirstAsync(u => u.Id == recordId, cancellationToken);
        if (record.Kind is not { } kind) return projectItem.OtherPhotosFolderId!;

        var recordItem = await FindItemAsync(DriveItemKind.Registro, record.Id, cancellationToken);
        var isNew = recordItem is null;
        recordItem ??= new DriveItem
        {
            OrganizationId = project.OrganizationId, Kind = DriveItemKind.Registro, EntityId = record.Id, State = DriveItemState.EmDia
        };
        await EnsureFolderAsync(recordItem, projectItem.PhotosFolderId!, await RecordFolderNameAsync(record, kind, cancellationToken),
            DriveNames.RecordTag(record.Id), cancellationToken);
        if (isNew) _db.DriveItems.Add(recordItem);
        return recordItem.DriveId!;
    }

    /// <summary>
    /// "2026-06-18 – Obra"; o segundo registro do mesmo tipo no mesmo dia (com fotos) ganha " (2)", e assim por diante,
    /// pela ordem de publicacao.
    /// </summary>
    private async Task<string> RecordFolderNameAsync(ProjectUpdate record, ProjectUpdateKind kind, CancellationToken cancellationToken)
    {
        var siblings = await _db.ProjectUpdates.AsNoTracking()
            .Where(u => u.ProjectId == record.ProjectId && u.Kind == kind
                        && u.Attachments.Any(a => a.ContentType.StartsWith("image/")))
            .Select(u => new ProjectUpdate { Id = u.Id, HappenedOn = u.HappenedOn, CreatedAt = u.CreatedAt })
            .ToListAsync(cancellationToken);
        var position = siblings.Where(u => u.Day == record.Day).OrderBy(u => u.CreatedAt).ThenBy(u => u.Id)
            .Select(u => u.Id).ToList().IndexOf(record.Id);
        return DriveNames.RecordFolder(record.Day, UpdateKinds.Label(kind), position + 1);
    }

    // ---------- relatorio final ----------

    /// <summary>
    /// Relatorio completo do projeto (do inicio a conclusao), na pasta do projeto: "Relatório final – Nome –
    /// AAAA-MM-DD.pdf". Reaberto antes de a rotina chegar nele: nao gera. Uma vez enviado, fica (nao e refeito).
    /// </summary>
    private async Task<bool> SyncFinalReportAsync(string root, DriveItem item, CancellationToken cancellationToken)
    {
        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == item.EntityId, cancellationToken);
        if (project is null || project.Status != ProjectStatus.Concluido) return false;
        if (item.DriveId is not null) return true;

        var projectItem = await ProjectItemAsync(root, project, cancellationToken);
        var tag = DriveNames.FinalReportTag(project.Id, item.Key);
        item.DriveId = await _drive.FindByTagAsync(projectItem.DriveId!, tag, cancellationToken);
        if (item.DriveId is null)
        {
            var name = DriveNames.FinalReport(project.Name, item.Key);
            item.DriveId = await _drive.UploadAsync(projectItem.DriveId!, name, "application/pdf",
                await FinalReportPdfAsync(project), tag, cancellationToken);
            item.Name = name;
        }

        item.ParentDriveId = projectItem.DriveId;
        return true;
    }

    /// <summary>O mesmo relatorio da tela Relatorios (formato completo, sem periodo), gerado no nucleo do projeto.</summary>
    private async Task<byte[]> FinalReportPdfAsync(Project project)
    {
        using var scope = _scopes.CreateScope();
        scope.ServiceProvider.GetRequiredService<CurrentUserOverride>().User =
            new JobUser(Guid.Empty, FinalReportAuthor, UserRole.Administrador, project.OrganizationId);
        var (content, _) = await scope.ServiceProvider.GetRequiredService<ReportService>().GenerateAsync(
            new ReportRequest { ProjectIds = new List<Guid> { project.Id }, Format = ReportFormat.Completo }, FinalReportAuthor);
        return content;
    }

    /// <summary>Id da pasta do programa, criando se preciso (um projeto precisa dela, seja o programa como for).</summary>
    private async Task<string> ProgramFolderAsync(string root, Guid programId, Guid organizationId,
        CancellationToken cancellationToken, bool recreate = false)
    {
        var item = await _db.DriveItems.FirstOrDefaultAsync(
            i => i.Kind == DriveItemKind.Programa && i.EntityId == programId && i.Key == "", cancellationToken);
        var isNew = item is null;
        item ??= new DriveItem
        {
            OrganizationId = organizationId, Kind = DriveItemKind.Programa, EntityId = programId, State = DriveItemState.EmDia
        };

        if (recreate) item.DriveId = null;
        if (item.DriveId is null)
        {
            var name = await _db.Programs.AsNoTracking().Where(p => p.Id == programId).Select(p => p.Name)
                .FirstAsync(cancellationToken);
            await EnsureFolderAsync(item, root, DriveNames.Clean(name), DriveNames.ProgramTag(programId), cancellationToken);
            item.UpdatedAt = DateTime.UtcNow;
        }

        // So entra na tabela depois de a pasta existir (com o Google fora do ar, nao fica item "em dia" sem pasta).
        if (isNew) _db.DriveItems.Add(item);
        return item.DriveId!;
    }

    /// <summary>
    /// A pasta do item existe dentro de parentId com este nome: renomeia ou move a que ja existe; se ela sumiu do
    /// Drive, ou ainda nao existe, acha pela etiqueta (rotina que caiu no meio) ou cria.
    /// </summary>
    private async Task EnsureFolderAsync(DriveItem item, string parentId, string name, string tag,
        CancellationToken cancellationToken)
    {
        if (item.DriveId is not null)
        {
            if (item.Name == name && item.ParentDriveId == parentId) return;
            try
            {
                await _drive.UpdateAsync(item.DriveId, item.Name == name ? null : name, item.ParentDriveId, parentId,
                    cancellationToken);
                item.Name = name;
                item.ParentDriveId = parentId;
                return;
            }
            catch (DriveItemMissingException)
            {
                item.DriveId = null;
            }
        }

        item.DriveId = await FindOrCreateFolderAsync(parentId, name, tag, cancellationToken);
        item.Name = name;
        item.ParentDriveId = parentId;
    }

    private async Task<string> FindOrCreateFolderAsync(string parentId, string name, string tag,
        CancellationToken cancellationToken)
    {
        var found = await _drive.FindByTagAsync(parentId, tag, cancellationToken);
        if (found is null) return await _drive.CreateFolderAsync(parentId, name, tag, cancellationToken);

        await _drive.UpdateAsync(found, name, null, null, cancellationToken);
        return found;
    }

    // ---------- falhas ----------

    private static TimeSpan Backoff(int attempts) => attempts switch
    {
        <= 1 => TimeSpan.FromMinutes(1),
        2 => TimeSpan.FromMinutes(5),
        3 => TimeSpan.FromMinutes(15),
        4 => TimeSpan.FromHours(1),
        5 => TimeSpan.FromHours(3),
        6 => TimeSpan.FromHours(6),
        7 => TimeSpan.FromHours(12),
        _ => TimeSpan.FromHours(24)
    };

    /// <summary>O motivo, para quem administra ver em Configuracoes › Google Drive.</summary>
    private static string Describe(Exception ex)
    {
        var message = ex switch
        {
            DriveItemMissingException =>
                "Uma pasta usada pela plataforma não foi encontrada no Drive, ou a conta da plataforma perdeu o acesso a ela.",
            GoogleApiException { HttpStatusCode: System.Net.HttpStatusCode.Forbidden } =>
                "O Google Drive recusou a operação. Confira se a conta da plataforma continua como Gerente de conteúdo do Drive compartilhado.",
            InvalidOperationException when ex.Message.Contains("nao configurado", StringComparison.Ordinal) =>
                "A ligação com o Google Drive não está configurada no servidor.",
            _ => $"Não foi possível falar com o Google Drive: {ex.Message}"
        };
        return message.Length > 500 ? message[..500] : message;
    }
}

/// <summary>Roda a rotina do Drive por tras, dentro da propria API, um item de cada vez.</summary>
public class DriveSyncWorker : BackgroundService
{
    private static readonly TimeSpan IdleWait = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan BusyPause = TimeSpan.FromMilliseconds(200);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<DriveSyncWorker> _logger;

    public DriveSyncWorker(IServiceScopeFactory scopes, ILogger<DriveSyncWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        while (!stoppingToken.IsCancellationRequested)
        {
            var worked = false;
            try
            {
                using var scope = _scopes.CreateScope();
                worked = await scope.ServiceProvider.GetRequiredService<DriveSyncService>().ProcessNextAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na rotina do Google Drive.");
            }

            try
            {
                await Task.Delay(worked ? BusyPause : IdleWait, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
