namespace Esf.Api.Domain.Entities;

/// <summary>
/// Conteudo de um arquivo enviado (foto, documento, logo). Fica no banco para nao se perder quando o
/// servidor e recriado a cada deploy; os demais registros apontam para ele pelo <see cref="StoredName"/>.
/// </summary>
public class StoredFile
{
    /// <summary>Nome gerado pela aplicacao (guid + extensao); e o que aparece em /uploads/{nome}.</summary>
    public string StoredName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public byte[] Content { get; set; } = Array.Empty<byte>();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
