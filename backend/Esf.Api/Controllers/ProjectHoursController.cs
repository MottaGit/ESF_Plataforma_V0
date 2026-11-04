using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Horas de voluntariado por projeto (cada um lanca as suas; a coordenacao, as de qualquer um da equipe).</summary>
[ApiController]
[Authorize]
[Route("api")]
public class ProjectHoursController : ControllerBase
{
    private readonly ProjectHoursService _hours;

    public ProjectHoursController(ProjectHoursService hours) => _hours = hours;

    [HttpGet("projects/{projectId:guid}/hours")]
    public async Task<ActionResult<ProjectHoursDto>> List(Guid projectId) => Ok(await _hours.ListAsync(projectId));

    [HttpPost("projects/{projectId:guid}/hours")]
    public async Task<ActionResult<ProjectHourEntryDto>> Create(Guid projectId, SaveHourEntryRequest request)
        => Ok(await _hours.CreateAsync(projectId, request));

    [HttpPut("hours/{id:guid}")]
    public async Task<ActionResult<ProjectHourEntryDto>> Update(Guid id, SaveHourEntryRequest request)
        => Ok(await _hours.UpdateAsync(id, request));

    [HttpDelete("hours/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _hours.DeleteAsync(id);
        return NoContent();
    }
}
