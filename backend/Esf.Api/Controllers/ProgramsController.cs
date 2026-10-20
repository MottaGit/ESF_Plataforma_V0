using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/programs")]
public class ProgramsController : ControllerBase
{
    private readonly ProgramService _programs;

    public ProgramsController(ProgramService programs) => _programs = programs;

    [HttpGet]
    public async Task<ActionResult<List<ProgramDto>>> List([FromQuery] bool onlyActive = true)
        => Ok(await _programs.ListAsync(onlyActive));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProgramDto>> Get(Guid id) => Ok(await _programs.GetAsync(id));

    [HttpPost]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProgramDto>> Create(SaveProgramRequest request)
        => Ok(await _programs.CreateAsync(request));

    /// <summary>Renomear e arquivar/reativar.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProgramDto>> Update(Guid id, UpdateProgramRequest request)
        => Ok(await _programs.UpdateAsync(id, request));

    /// <summary>So para programa sem projetos.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _programs.DeleteAsync(id);
        return NoContent();
    }
}
