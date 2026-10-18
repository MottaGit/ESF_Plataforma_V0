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
    private readonly ICurrentUser _currentUser;

    public ActivitiesController(ActivityService activities, ICurrentUser currentUser)
    {
        _activities = activities;
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
        => Ok(await _activities.UpdateStatusAsync(id, request.Status!.Value));

    [HttpDelete("activities/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _activities.DeleteAsync(id);
        return NoContent();
    }
}
