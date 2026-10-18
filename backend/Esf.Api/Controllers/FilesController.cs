using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class FilesController : ControllerBase
{
    private readonly ProjectFileService _files;
    private readonly ICurrentUser _currentUser;

    public FilesController(ProjectFileService files, ICurrentUser currentUser)
    {
        _files = files;
        _currentUser = currentUser;
    }

    [HttpGet("projects/{projectId:guid}/files")]
    public async Task<ActionResult<List<ProjectFileDto>>> ListByProject(Guid projectId)
        => Ok(await _files.ListByProjectAsync(projectId));

    [HttpPost("projects/{projectId:guid}/files")]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<ActionResult<ProjectFileDto>> Upload(
        Guid projectId,
        [FromForm] IFormFile file,
        [FromForm] string? description)
        => Ok(await _files.UploadAsync(projectId, file, description, _currentUser.Id));

    [HttpGet("files/{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var (content, contentType, fileName) = await _files.GetDownloadAsync(id);
        return File(content, contentType, fileName);
    }

    [HttpPut("files/{id:guid}")]
    public async Task<ActionResult<ProjectFileDto>> UpdateDescription(Guid id, SaveFileDescriptionRequest request)
        => Ok(await _files.UpdateDescriptionAsync(id, request.Description));

    [HttpDelete("files/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _files.DeleteAsync(id);
        return NoContent();
    }
}
