using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Avisos do usuario logado (do voluntario vinculado ao acesso).</summary>
[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _notifications;

    public NotificationsController(NotificationService notifications) => _notifications = notifications;

    /// <summary>Os 30 mais recentes e quantos nao foram lidos.</summary>
    [HttpGet]
    public async Task<ActionResult<NotificationsDto>> List() => Ok(await _notifications.ListAsync());

    /// <summary>So a quantidade de nao lidos (o sininho consulta de tempos em tempos).</summary>
    [HttpGet("unread")]
    public async Task<ActionResult<UnreadNotificationsDto>> Unread() => Ok(await _notifications.GetUnreadAsync());

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        await _notifications.MarkReadAsync(id);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await _notifications.MarkAllReadAsync();
        return NoContent();
    }
}
