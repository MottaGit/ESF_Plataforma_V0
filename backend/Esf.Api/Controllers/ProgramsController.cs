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

    [HttpPost]
    [Authorize(Policy = Policies.ManageProjects)]
    public async Task<ActionResult<ProgramDto>> Create(SaveProgramRequest request)
        => Ok(await _programs.CreateAsync(request));
}
