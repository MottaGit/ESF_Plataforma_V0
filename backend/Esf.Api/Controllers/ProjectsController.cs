using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly ProjectService _projects;
    private readonly FileStorageService _storage;

    public ProjectsController(ProjectService projects, FileStorageService storage)
    {
        _projects = projects;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectListItemDto>>> List([FromQuery] ProjectQuery query)
        => Ok(await _projects.ListAsync(query));

    [HttpGet("categories")]
    public async Task<ActionResult<List<string>>> Categories()
        => Ok(await _projects.ListCategoriesAsync());

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDetailDto>> Get(Guid id)
        => Ok(await _projects.GetDetailAsync(id));

    [HttpPost]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProjectDetailDto>> Create(SaveProjectRequest request)
    {
        var created = await _projects.CreateAsync(request);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProjectDetailDto>> Update(Guid id, SaveProjectRequest request)
        => Ok(await _projects.UpdateAsync(id, request));

    /// <summary>Alterar status e progresso e permitido a qualquer usuario autenticado (execucao do projeto).</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ProjectDetailDto>> UpdateStatus(Guid id, UpdateProjectStatusRequest request)
        => Ok(await _projects.UpdateStatusAsync(id, request.Status!.Value));

    [HttpPatch("{id:guid}/progress")]
    public async Task<ActionResult<ProjectDetailDto>> UpdateProgress(Guid id, UpdateProjectProgressRequest request)
        => Ok(await _projects.UpdateProgressAsync(id, request.Progress));

    [HttpPost("{id:guid}/archive")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProjectDetailDto>> Archive(Guid id)
        => Ok(await _projects.SetArchivedAsync(id, true));

    [HttpPost("{id:guid}/unarchive")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProjectDetailDto>> Unarchive(Guid id)
        => Ok(await _projects.SetArchivedAsync(id, false));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var storedFiles = await _projects.DeleteAsync(id);
        _storage.DeleteMany(storedFiles);
        return NoContent();
    }
}
