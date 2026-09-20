using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class VolunteersController : ControllerBase
{
    private readonly VolunteerService _volunteers;

    public VolunteersController(VolunteerService volunteers) => _volunteers = volunteers;

    [HttpGet("volunteers")]
    public async Task<ActionResult<List<VolunteerDto>>> List(
        [FromQuery] string? search,
        [FromQuery] bool onlyActive = false,
        [FromQuery] VolunteerSector? sector = null)
        => Ok(await _volunteers.ListAsync(search, onlyActive, sector));

    [HttpPost("volunteers")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<VolunteerDto>> Create(SaveVolunteerRequest request)
        => Ok(await _volunteers.CreateAsync(request));

    [HttpPut("volunteers/{id:guid}")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<VolunteerDto>> Update(Guid id, SaveVolunteerRequest request)
        => Ok(await _volunteers.UpdateAsync(id, request));

    [HttpDelete("volunteers/{id:guid}")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _volunteers.DeleteAsync(id);
        return NoContent();
    }

    [HttpGet("projects/{projectId:guid}/volunteers")]
    public async Task<ActionResult<List<ProjectVolunteerDto>>> ListByProject(Guid projectId)
        => Ok(await _volunteers.ListByProjectAsync(projectId));

    [HttpPost("projects/{projectId:guid}/volunteers")]
    public async Task<ActionResult<ProjectVolunteerDto>> AddToProject(Guid projectId, AddProjectVolunteerRequest request)
        => Ok(await _volunteers.AddToProjectAsync(projectId, request));

    [HttpDelete("projects/{projectId:guid}/volunteers/{volunteerId:guid}")]
    public async Task<IActionResult> RemoveFromProject(Guid projectId, Guid volunteerId)
    {
        await _volunteers.RemoveFromProjectAsync(projectId, volunteerId);
        return NoContent();
    }
}
