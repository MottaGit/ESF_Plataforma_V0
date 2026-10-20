namespace Esf.Api.Domain.Entities;

/// <summary>
/// Uma alteracao feita por alguem na plataforma (historico de alteracoes, visto so por administradores).
/// Nomes de voluntarios entram como referencia ([[vol:id]]) e sao resolvidos na hora de exibir, e os dados
/// pessoais do cadastro de voluntario nao guardam valores: assim a anonimizacao vale tambem para o historico.
/// </summary>
public class AuditEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime At { get; set; } = DateTime.UtcNow;

    public Guid? UserId { get; set; }
    /// <summary>Nome de quem fez, no momento (usado se o acesso for excluido depois).</summary>
    public string UserName { get; set; } = string.Empty;

    public AuditAction Action { get; set; }
    /// <summary>Tipo do registro, ja em portugues (Projeto, Atividade, Voluntario...).</summary>
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string EntityLabel { get; set; } = string.Empty;

    /// <summary>Projeto relacionado, para filtrar o historico por projeto.</summary>
    public Guid? ProjectId { get; set; }

    /// <summary>Campos alterados em JSON: [{ "field": "Status", "before": "...", "after": "..." }].</summary>
    public string? Changes { get; set; }
}
