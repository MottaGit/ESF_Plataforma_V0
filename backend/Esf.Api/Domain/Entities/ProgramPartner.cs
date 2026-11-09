namespace Esf.Api.Domain.Entities;

/// <summary>
/// Parceiro do programa (financiador, apoiador, poder publico...). O nome e o papel aparecem na visao do programa, na
/// pagina publica e no relatorio em PDF; o contato (pessoa, e-mail, telefone) e as observacoes ficam so dentro do
/// nucleo. Por enquanto so do programa: projetos nao tem parceiros proprios.
/// </summary>
public class ProgramPartner
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProgramId { get; set; }
    public ProjectProgram? Program { get; set; }

    /// <summary>Ordem na lista (o principal primeiro), a mesma da pagina publica e do PDF.</summary>
    public int Position { get; set; }

    /// <summary>Nome da organizacao parceira.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Papel na parceria, texto livre (ex.: Financiador, Apoiador, Parceiro técnico, Poder público).</summary>
    public string? Role { get; set; }

    public string? ContactName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
