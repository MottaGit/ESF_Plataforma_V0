using Esf.Api.Drive;

namespace Esf.Api.Tests;

/// <summary>Google Drive em memoria: pastas e arquivos com pai, etiqueta e lixeira, como o de verdade.</summary>
public sealed class FakeDriveClient : IDriveClient
{
    public sealed class Item
    {
        public required string Id { get; init; }
        public required string Name { get; set; }
        public string? ParentId { get; set; }
        public string? Tag { get; init; }
        public bool IsFolder { get; init; }
        public bool Trashed { get; set; }
        public bool SharedDrive { get; init; }
        public bool CanAddChildren { get; init; } = true;
        public string? ContentType { get; init; }
        public byte[]? Content { get; init; }
    }

    private int _next;

    public Dictionary<string, Item> Items { get; } = new();

    public bool IsConfigured { get; set; } = true;

    public string? AccountEmail => "plataforma@esf-teste.iam.gserviceaccount.com";

    /// <summary>Google fora do ar: toda chamada falha.</summary>
    public bool Down { get; set; }

    /// <summary>Quantas pastas e arquivos foram criados (para conferir que nada duplicou).</summary>
    public int Created { get; private set; }

    /// <summary>Pasta de um Drive compartilhado (ou do Meu Drive), como a que o nucleo cria e compartilha.</summary>
    public string AddRootFolder(string name, bool sharedDrive = true, bool canAddChildren = true)
    {
        var id = NewId();
        Items[id] = new Item { Id = id, Name = name, IsFolder = true, SharedDrive = sharedDrive, CanAddChildren = canAddChildren };
        return id;
    }

    public static string LinkTo(string folderId) => $"https://drive.google.com/drive/u/1/folders/{folderId}?usp=sharing";

    /// <summary>Itens que estao dentro da pasta (fora da lixeira), pelo nome.</summary>
    public List<Item> Children(string parentId) =>
        Items.Values.Where(i => i.ParentId == parentId && !i.Trashed).OrderBy(i => i.Name, StringComparer.Ordinal).ToList();

    public List<string> ChildNames(string parentId) => Children(parentId).Select(i => i.Name).ToList();

    /// <summary>O item no caminho a partir da pasta (ex.: "Banheiros/Projeto a/04. Fotos e vídeos"), ou null.</summary>
    public Item? At(string rootId, string path)
    {
        var current = rootId;
        Item? item = null;
        foreach (var part in path.Split('/'))
        {
            item = Children(current).SingleOrDefault(i => i.Name == part);
            if (item is null) return null;
            current = item.Id;
        }

        return item;
    }

    public Task<DriveFolder?> GetFolderAsync(string folderId, CancellationToken cancellationToken = default)
    {
        Check();
        return Task.FromResult(Items.TryGetValue(folderId, out var item) && item.IsFolder && !item.Trashed
            ? new DriveFolder(item.Id, item.Name, item.CanAddChildren, item.SharedDrive || item.ParentId is not null)
            : null);
    }

    public Task<string?> FindByTagAsync(string parentId, string tag, CancellationToken cancellationToken = default)
    {
        Check();
        Existing(parentId);
        return Task.FromResult(Children(parentId).FirstOrDefault(i => i.Tag == tag)?.Id);
    }

    public Task<string> CreateFolderAsync(string parentId, string name, string tag, CancellationToken cancellationToken = default)
    {
        Check();
        Existing(parentId);
        var id = NewId();
        Items[id] = new Item { Id = id, Name = name, ParentId = parentId, Tag = tag, IsFolder = true };
        Created++;
        return Task.FromResult(id);
    }

    public Task<string> UploadAsync(string parentId, string name, string contentType, byte[] content, string tag,
        CancellationToken cancellationToken = default)
    {
        Check();
        Existing(parentId);
        var id = NewId();
        Items[id] = new Item { Id = id, Name = name, ParentId = parentId, Tag = tag, ContentType = contentType, Content = content };
        Created++;
        return Task.FromResult(id);
    }

    public Task UpdateAsync(string id, string? newName, string? oldParentId, string? newParentId,
        CancellationToken cancellationToken = default)
    {
        Check();
        var item = Existing(id);
        if (newName is not null) item.Name = newName;
        if (newParentId is not null)
        {
            Existing(newParentId);
            item.ParentId = newParentId;
        }

        return Task.CompletedTask;
    }

    public Task TrashAsync(string id, CancellationToken cancellationToken = default)
    {
        Check();
        if (Items.TryGetValue(id, out var item)) item.Trashed = true;
        return Task.CompletedTask;
    }

    /// <summary>Alguem apagou o item de vez, direto no Drive (some com o que estiver dentro).</summary>
    public void DeleteForever(string id)
    {
        foreach (var child in Items.Values.Where(i => i.ParentId == id).ToList()) DeleteForever(child.Id);
        Items.Remove(id);
    }

    private Item Existing(string id) =>
        Items.TryGetValue(id, out var item) ? item : throw new DriveItemMissingException($"Item {id} nao existe.");

    private void Check()
    {
        if (Down) throw new HttpRequestException("Google fora do ar.");
    }

    // Ids do tamanho dos do Google (o link colado so vale com 10 caracteres ou mais).
    private string NewId() => $"driveItem{++_next:D6}";
}
