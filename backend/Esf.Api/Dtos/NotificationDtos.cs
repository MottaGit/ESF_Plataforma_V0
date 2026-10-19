using Esf.Api.Domain;

namespace Esf.Api.Dtos;

public record NotificationDto(
    Guid Id,
    NotificationType Type,
    string Message,
    // Linha de apoio, normalmente o nome do projeto.
    string? Context,
    Guid? ProjectId,
    Guid? ActivityId,
    DateTime CreatedAt,
    bool Read);

/// <summary>
/// Avisos do usuario logado. Linked=false quando o acesso nao esta vinculado a um voluntario (sem como
/// saber o que e dele): a lista vem vazia e a tela explica como pedir o vinculo.
/// </summary>
public record NotificationsDto(bool Linked, int UnreadCount, List<NotificationDto> Items);

public record UnreadNotificationsDto(bool Linked, int Count);
