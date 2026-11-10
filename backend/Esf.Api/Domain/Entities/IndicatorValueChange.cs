namespace Esf.Api.Domain.Entities;

/// <summary>
/// Historico do valor de um indicador: cada vez que o numero muda, uma linha com o novo valor e o momento. Os
/// indicadores sao acumulados (120 pessoas desde o inicio); e o historico que deixa o relatorio mostrar o valor no fim
/// do periodo e quanto ele mudou dentro do periodo. Gravado sozinho no SaveChanges do EsfDbContext, qualquer que seja o
/// caminho (tela, conclusao do projeto, planilha, demonstracao).
/// </summary>
public class IndicatorValueChange
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid IndicatorId { get; set; }
    public Indicator? Indicator { get; set; }

    /// <summary>Valor a partir deste momento (vazio: voltou a "nao informado").</summary>
    public decimal? Value { get; set; }

    /// <summary>Desde quando o valor vale (UTC): o ValueUpdatedAt do indicador na hora da mudanca.</summary>
    public DateTime ChangedAt { get; set; }
}
