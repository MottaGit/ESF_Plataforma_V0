using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

/// <summary>Resumo: so os numeros somados e a tabela dos projetos. Completo: mais um capitulo por projeto.</summary>
public enum ReportFormat
{
    Completo,
    Resumo
}

public class ReportRequest
{
    [Required(ErrorMessage = "Selecione ao menos um projeto.")]
    [MinLength(1, ErrorMessage = "Selecione ao menos um projeto.")]
    public List<Guid> ProjectIds { get; set; } = new();

    public ReportFormat Format { get; set; } = ReportFormat.Completo;

    public bool IncludeVolunteers { get; set; } = true;
    public bool IncludeIndicators { get; set; } = true;
    public bool IncludeUpdates { get; set; } = true;
    public bool IncludePhotos { get; set; } = true;
    public bool IncludeTasks { get; set; } = true;

    /// <summary>
    /// Periodo de referencia (opcional, cada ponta pode ficar vazia): registros de andamento, fotos e tarefas
    /// concluidas so desse intervalo. Indicadores e equipe saem como estao hoje.
    /// </summary>
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }

    /// <summary>Observacao livre impressa no inicio do relatorio (ex.: finalidade, parceiro).</summary>
    [StringLength(600, ErrorMessage = "A observação do relatório pode ter até 600 caracteres.")]
    public string? Note { get; set; }
}

/// <summary>
/// O que um projeto tem no periodo de referencia, para a tela Relatorios mostrar antes de gerar: registros de
/// andamento, fotos que entram no PDF (as mesmas regras do relatorio) e tarefas concluidas.
/// </summary>
public record ReportPeriodCountDto(Guid ProjectId, int Updates, int Photos, int Tasks);
