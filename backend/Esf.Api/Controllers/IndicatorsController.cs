using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class IndicatorsController : ControllerBase
{
    private readonly IndicatorService _indicators;

    public IndicatorsController(IndicatorService indicators) => _indicators = indicators;

    [HttpGet("projects/{projectId:guid}/indicators")]
    public async Task<ActionResult<List<IndicatorDto>>> ListByProject(Guid projectId)
        => Ok(await _indicators.ListByProjectAsync(projectId));

    [HttpPost("projects/{projectId:guid}/indicators")]
    public async Task<ActionResult<IndicatorDto>> Create(Guid projectId, SaveIndicatorRequest request)
        => Ok(await _indicators.CreateAsync(projectId, request));

    [HttpPut("indicators/{id:guid}")]
    public async Task<ActionResult<IndicatorDto>> Update(Guid id, SaveIndicatorRequest request)
        => Ok(await _indicators.UpdateAsync(id, request));

    [HttpDelete("indicators/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _indicators.DeleteAsync(id);
        return NoContent();
    }
}
