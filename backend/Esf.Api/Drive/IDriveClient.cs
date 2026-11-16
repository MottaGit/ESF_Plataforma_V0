namespace Esf.Api.Drive;

/// <summary>Pasta do Drive como a plataforma a ve: nome, se da para criar coisas dentro e se e de um Drive compartilhado.</summary>
public record DriveFolder(string Id, string Name, bool CanAddChildren, bool InSharedDrive);

/// <summary>O item nao existe mais no Drive (apagado de vez por alguem) ou a plataforma perdeu o acesso a ele.</summary>
public class DriveItemMissingException : Exception
{
    public DriveItemMissingException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}

/// <summary>
/// O que a plataforma faz no Google Drive. Cada item criado leva uma etiqueta (tag) com o id da plataforma: se a rotina
/// cair no meio (depois de criar, antes de gravar o id), na proxima vez ela acha o item pela etiqueta e nao duplica.
/// Os testes usam uma versao em memoria; o servidor, o GoogleDriveClient.
/// </summary>
public interface IDriveClient
{
    /// <summary>Ha conta de servico configurada no servidor.</summary>
    bool IsConfigured { get; }

    /// <summary>E-mail da conta de servico: e ela que o nucleo adiciona como membro do Drive compartilhado.</summary>
    string? AccountEmail { get; }

    /// <summary>A pasta, ou null se ela nao existe ou a conta nao tem acesso.</summary>
    Task<DriveFolder?> GetFolderAsync(string folderId, CancellationToken cancellationToken = default);

    /// <summary>Id do item com a etiqueta dentro da pasta (fora da lixeira), ou null.</summary>
    Task<string?> FindByTagAsync(string parentId, string tag, CancellationToken cancellationToken = default);

    Task<string> CreateFolderAsync(string parentId, string name, string tag, CancellationToken cancellationToken = default);

    Task<string> UploadAsync(string parentId, string name, string contentType, byte[] content, string tag,
        CancellationToken cancellationToken = default);

    /// <summary>Renomeia (newName) e/ou move de oldParentId para newParentId.</summary>
    Task UpdateAsync(string id, string? newName, string? oldParentId, string? newParentId,
        CancellationToken cancellationToken = default);

    /// <summary>Manda para a lixeira do Drive (recuperavel por 30 dias). Item que ja nao existe conta como feito.</summary>
    Task TrashAsync(string id, CancellationToken cancellationToken = default);
}
