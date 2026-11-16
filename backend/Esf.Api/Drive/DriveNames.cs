using System.Text.RegularExpressions;

namespace Esf.Api.Drive;

/// <summary>Nomes e etiquetas do que a plataforma cria no Drive (uma regra so, usada pela rotina e pelos testes).</summary>
public static partial class DriveNames
{
    /// <summary>Subpastas fixas de todo projeto, na ordem em que aparecem no Drive.</summary>
    public const string Management = "01. Gestão";
    public const string Technical = "02. Projeto técnico";
    public const string Budget = "03. Orçamento e compras";
    public const string Photos = "04. Fotos e vídeos";
    public const string OtherPhotos = "Outras fotos";
    public const string Documents = "05. Documentos";

    /// <summary>Subpasta fixa: o apelido (na etiqueta, sem acento) e o nome que aparece no Drive.</summary>
    public record Subfolder(string Slot, string Name);

    public static readonly Subfolder ManagementFolder = new("gestao", Management);
    public static readonly Subfolder TechnicalFolder = new("tecnico", Technical);
    public static readonly Subfolder BudgetFolder = new("orcamento", Budget);
    public static readonly Subfolder PhotosFolder = new("fotos", Photos);
    public static readonly Subfolder DocumentsFolder = new("documentos", Documents);
    /// <summary>Dentro de "04. Fotos e vídeos": fotos que nao vieram de um registro com tipo.</summary>
    public static readonly Subfolder OtherPhotosFolder = new("outras", OtherPhotos);

    public static readonly Subfolder[] ProjectSubfolders =
        { ManagementFolder, TechnicalFolder, BudgetFolder, PhotosFolder, DocumentsFolder };

    /// <summary>Endereco para abrir a pasta no navegador.</summary>
    public static string FolderUrl(string folderId) => $"https://drive.google.com/drive/folders/{folderId}";

    /// <summary>
    /// Id da pasta a partir do que a pessoa colou: o link inteiro (drive.google.com/drive/folders/ID?...,
    /// .../u/1/folders/ID, ...open?id=ID) ou so o id. Null se nao parecer uma pasta do Drive.
    /// </summary>
    public static string? FolderIdFrom(string? input)
    {
        var text = input?.Trim();
        if (string.IsNullOrEmpty(text)) return null;

        var match = FolderInLink().Match(text);
        if (match.Success) return match.Groups["id"].Value;
        match = IdParameter().Match(text);
        if (match.Success) return match.Groups["id"].Value;
        return BareId().IsMatch(text) ? text : null;
    }

    /// <summary>Nome valido no Drive: sem barra (confunde com caminho), espacos simples, tamanho limitado.</summary>
    public static string Clean(string? name)
    {
        var text = Spaces().Replace((name ?? string.Empty).Replace('/', '-').Replace('\\', '-'), " ").Trim();
        if (text.Length > 120) text = text[..120].TrimEnd();
        return text.Length == 0 ? "Sem nome" : text;
    }

    public static string ProgramTag(Guid id) => $"programa:{id:N}";
    public static string ProjectTag(Guid id) => $"projeto:{id:N}";
    public static string SubfolderTag(Guid projectId, Subfolder subfolder) => $"projeto:{projectId:N}:{subfolder.Slot}";

    [GeneratedRegex(@"/folders/(?<id>[A-Za-z0-9_-]{10,})")]
    private static partial Regex FolderInLink();

    [GeneratedRegex(@"[?&]id=(?<id>[A-Za-z0-9_-]{10,})")]
    private static partial Regex IdParameter();

    [GeneratedRegex(@"^[A-Za-z0-9_-]{10,}$")]
    private static partial Regex BareId();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
