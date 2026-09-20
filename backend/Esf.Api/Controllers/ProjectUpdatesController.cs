using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class ProjectUpdatesController : ControllerBase
{
    private readonly ProjectUpdateService _updates;
    private readonly ICurrentUser _currentUser;

    public ProjectUpdatesController(ProjectUpdateService updates, ICurrentUser currentUser)
    {
        _updates = updates;
        _currentUser = currentUser;
    }

    [HttpGet("projects/{projectId:guid}/updates")]
    public async Task<ActionResult<List<ProjectUpdateDto>>> ListByProject(Guid projectId)
        => Ok(await _updates.ListByProjectAsync(projectId));

    [HttpPost("projects/{projectId:guid}/updates")]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<ActionResult<ProjectUpdateDto>> Create(Guid projectId, [FromForm] CreateProjectUpdateRequest request)
        => Ok(await _updates.CreateAsync(projectId, request, _currentUser.Id));

    [HttpPut("updates/{id:guid}")]
    public async Task<ActionResult<ProjectUpdateDto>> Update(Guid id, SaveProjectUpdateRequest request)
        => Ok(await _updates.UpdateAsync(id, request));

    [HttpDelete("updates/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _updates.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("updates/{id:guid}/attachments")]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<ActionResult<ProjectFileDto>> AddAttachment(Guid id, [FromForm] IFormFile file)
        => Ok(await _updates.AddAttachmentAsync(id, file, _currentUser.Id));

    [HttpDelete("updates/{id:guid}/attachments/{fileId:guid}")]
    public async Task<IActionResult> RemoveAttachment(Guid id, Guid fileId)
    {
        await _updates.RemoveAttachmentAsync(id, fileId);
        return NoContent();
    }
}
