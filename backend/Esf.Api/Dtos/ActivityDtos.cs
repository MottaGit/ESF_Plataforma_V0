using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record ActivityDto(
    Guid Id,
    Guid ProjectId,
    string? ProjectName,
    string Title,
    string? Description,
    Guid? AssignedVolunteerId,
    string? AssignedVolunteerName,
    ActivityStatus Status,
    ActivityPriority Priority,
    DateOnly? DueDate,
    string? Notes,
    bool IsLate,
    DateTime CreatedAt,
    DateTime? CompletedAt);

public class SaveActivityRequest
{
    [Required(ErrorMessage = "Informe o titulo da atividade.")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "O titulo deve ter entre 3 e 200 caracteres.")]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public Guid? AssignedVolunteerId { get; set; }

    [Required(ErrorMessage = "Selecione o status.")]
    public ActivityStatus? Status { get; set; }

    [Required(ErrorMessage = "Selecione a prioridade.")]
    public ActivityPriority? Priority { get; set; }

    public DateOnly? DueDate { get; set; }
    public string? Notes { get; set; }
}

public class UpdateActivityStatusRequest
{
    [Required(ErrorMessage = "Selecione o status.")]
    public ActivityStatus? Status { get; set; }
}
