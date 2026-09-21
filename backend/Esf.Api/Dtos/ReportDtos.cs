using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

public class ReportRequest
{
    [Required(ErrorMessage = "Selecione ao menos um projeto.")]
    [MinLength(1, ErrorMessage = "Selecione ao menos um projeto.")]
    public List<Guid> ProjectIds { get; set; } = new();

    public bool IncludeActivities { get; set; } = true;
    public bool IncludeVolunteers { get; set; } = true;
    public bool IncludeIndicators { get; set; } = true;
    public bool IncludeUpdates { get; set; } = true;
    public bool IncludePhotos { get; set; } = true;

    /// <summary>Observacao livre impressa no inicio do relatorio (ex.: finalidade, parceiro).</summary>
    [StringLength(600)]
    public string? Note { get; set; }
}
