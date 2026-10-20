using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class ActivitiesController : ControllerBase
{
    private readonly ActivityService _activities;
    private readonly ActivityCommentService _comments;
    private readonly ICurrentUser _currentUser;

    public ActivitiesController(ActivityService activities, ActivityCommentService comments, ICurrentUser currentUser)
    {
        _activities = activities;
        _comments = comments;
        _currentUser = currentUser;
    }

    [HttpGet("projects/{projectId:guid}/activities")]
    public async Task<ActionResult<List<ActivityDto>>> ListByProject(Guid projectId)
        => Ok(await _activities.ListByProjectAsync(projectId));

    /// <summary>Proximos prazos pendentes. Com mine=true, so os do voluntario vinculado ao usuario logado.</summary>
    [HttpGet("activities/upcoming")]
    public async Task<ActionResult<List<ActivityDto>>> Upcoming([FromQuery] int take = 8, [FromQuery] bool mine = false)
    {
        take = Math.Clamp(take, 1, 50);
        return Ok(mine
            ? await _activities.ListUpcomingForUserAsync(_currentUser.RequireId(), take)
            : await _activities.ListUpcomingAsync(take));
    }

    /// <summary>Quadro de atividades da tela de Projetos (projetos ativos; concluidas dos ultimos 30 dias).</summary>
    [HttpGet("activities/board")]
    public async Task<ActionResult<List<ActivityDto>>> Board()
        => Ok(await _activities.ListBoardAsync());

    [HttpPost("projects/{projectId:guid}/activities")]
    public async Task<ActionResult<ActivityDto>> Create(Guid projectId, SaveActivityRequest request)
        => Ok(await _activities.CreateAsync(projectId, request));

    [HttpPut("activities/{id:guid}")]
    public async Task<ActionResult<ActivityDto>> Update(Guid id, SaveActivityRequest request)
        => Ok(await _activities.UpdateAsync(id, request));

    [HttpPatch("activities/{id:guid}/status")]
    public async Task<ActionResult<ActivityDto>> UpdateStatus(Guid id, UpdateActivityStatusRequest request)
        => Ok(await _activities.UpdateStatusAsync(id, request.Status!.Value, request.BlockedReason));

    [HttpDelete("activities/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _activities.DeleteAsync(id);
        return NoContent();
    }

    /// <summary>O que fica dentro da atividade: checklist e anexos.</summary>
    [HttpGet("activities/{id:guid}/details")]
    public async Task<ActionResult<ActivityDetailsDto>> Details(Guid id) => Ok(await _activities.GetDetailsAsync(id));

    [HttpPost("activities/{id:guid}/checklist")]
    public async Task<ActionResult<ChecklistItemDto>> AddChecklistItem(Guid id, SaveChecklistItemRequest request)
        => Ok(await _activities.AddChecklistItemAsync(id, request));

    [HttpPut("checklist/{itemId:guid}")]
    public async Task<ActionResult<ChecklistItemDto>> UpdateChecklistItem(Guid itemId, UpdateChecklistItemRequest request)
        => Ok(await _activities.UpdateChecklistItemAsync(itemId, request));

    [HttpDelete("checklist/{itemId:guid}")]
    public async Task<IActionResult> DeleteChecklistItem(Guid itemId)
    {
        await _activities.DeleteChecklistItemAsync(itemId);
        return NoContent();
    }

    /// <summary>Quem pode ser mencionado com @ nos comentarios desta atividade (a equipe vem primeiro).</summary>
    [HttpGet("activities/{id:guid}/mentionable")]
    public async Task<ActionResult<List<MentionableDto>>> Mentionable(Guid id) => Ok(await _comments.MentionableAsync(id));

    [HttpPost("activities/{id:guid}/comments")]
    public async Task<ActionResult<CommentDto>> AddComment(Guid id, SaveCommentRequest request)
        => Ok(await _comments.AddAsync(id, request));

    /// <summary>So quem escreveu.</summary>
    [HttpPut("comments/{commentId:guid}")]
    public async Task<ActionResult<CommentDto>> UpdateComment(Guid commentId, SaveCommentRequest request)
        => Ok(await _comments.UpdateAsync(commentId, request));

    /// <summary>Quem escreveu ou a coordenacao.</summary>
    [HttpDelete("comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid commentId)
    {
        await _comments.DeleteAsync(commentId);
        return NoContent();
    }
}
