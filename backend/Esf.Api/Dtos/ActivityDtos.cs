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
    DateTime? CompletedAt,
    // Foto do responsavel (null sem responsavel ou sem foto).
    string? AssignedVolunteerPhotoUrl,
    // O que esta travando a atividade (so quando bloqueada).
    string? BlockedReason,
    // Programa do projeto (preenchido quando o projeto e seu programa foram carregados).
    Guid? ProgramId,
    string? ProgramName,
    // Resumo do que fica dentro da atividade (checklist e anexos), para os cards e a lista.
    int ChecklistTotal,
    int ChecklistDone,
    int AttachmentsCount,
    int CommentsCount,
    // Icone e cor do programa (preenchidos quando o projeto e seu programa foram carregados).
    string? ProgramIcon,
    string? ProgramColor);

public record ChecklistItemDto(Guid Id, string Text, bool Done, DateTime? DoneAt);

/// <summary>O que fica dentro da atividade: checklist, anexos e comentarios.</summary>
public record ActivityDetailsDto(List<ChecklistItemDto> Checklist, List<ProjectFileDto> Attachments, List<CommentDto> Comments);

public record MentionDto(Guid VolunteerId, string Name);

public record CommentDto(
    Guid Id,
    Guid? AuthorUserId,
    string AuthorName,
    string? AuthorPhotoUrl,
    string Text,
    List<MentionDto> Mentions,
    DateTime CreatedAt,
    DateTime? EditedAt,
    // Editar: so quem escreveu. Apagar: quem escreveu e a coordenacao.
    bool CanEdit,
    bool CanDelete);

/// <summary>Quem pode ser mencionado com @ (tem acesso a plataforma); InTeam: esta na equipe do projeto.</summary>
public record MentionableDto(Guid VolunteerId, string Name, string? PhotoUrl, bool InTeam);

public class SaveCommentRequest
{
    [Required(ErrorMessage = "Escreva o comentario.")]
    [StringLength(2000, MinimumLength = 1, ErrorMessage = "O comentario deve ter ate 2000 caracteres.")]
    public string Text { get; set; } = string.Empty;

    /// <summary>Voluntarios mencionados com @ (recebem aviso).</summary>
    public List<Guid>? MentionedVolunteerIds { get; set; }
}

public class SaveChecklistItemRequest
{
    [Required(ErrorMessage = "Escreva o item.")]
    [StringLength(300, MinimumLength = 1, ErrorMessage = "O item deve ter ate 300 caracteres.")]
    public string Text { get; set; } = string.Empty;
}

/// <summary>Marcar/desmarcar e/ou reescrever um item (o que vier vazio fica como esta).</summary>
public class UpdateChecklistItemRequest
{
    [StringLength(300, MinimumLength = 1, ErrorMessage = "O item deve ter ate 300 caracteres.")]
    public string? Text { get; set; }

    public bool? Done { get; set; }
}

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

    /// <summary>Opcional; so e guardado quando o status e Bloqueada.</summary>
    [StringLength(300, ErrorMessage = "Descreva o bloqueio em ate 300 caracteres.")]
    public string? BlockedReason { get; set; }
}

public class UpdateActivityStatusRequest
{
    [Required(ErrorMessage = "Selecione o status.")]
    public ActivityStatus? Status { get; set; }

    /// <summary>Opcional; so e guardado quando o status e Bloqueada.</summary>
    [StringLength(300, ErrorMessage = "Descreva o bloqueio em ate 300 caracteres.")]
    public string? BlockedReason { get; set; }
}
