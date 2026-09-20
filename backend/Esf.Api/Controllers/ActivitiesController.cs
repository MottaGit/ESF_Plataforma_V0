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

    public ActivitiesController(ActivityService activities) => _activities = activities;

    [HttpGet("projects/{projectId:guid}/activities")]
    public async Task<ActionResult<List<ActivityDto>>> ListByProject(Guid projectId)
        => Ok(await _activities.ListByProjectAsync(projectId));

    [HttpGet("activities/upcoming")]
    public async Task<ActionResult<List<ActivityDto>>> Upcoming([FromQuery] int take = 8)
        => Ok(await _activities.ListUpcomingAsync(Math.Clamp(take, 1, 50)));

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
