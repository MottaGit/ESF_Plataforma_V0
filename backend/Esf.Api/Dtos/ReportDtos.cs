using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public class ReportRequest
{
    [Required(ErrorMessage = "Selecione ao menos um projeto.")]
    [MinLength(1, ErrorMessage = "Selecione ao menos um projeto.")]
    public List<Guid> ProjectIds { get; set; } = new();

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
    [StringLength(600)]
    public string? Note { get; set; }
}
