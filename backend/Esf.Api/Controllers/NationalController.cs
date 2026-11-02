using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Gestao nacional: nucleos, quem os administra e as pessoas da propria gestao nacional.</summary>
[ApiController]
[Authorize(Policy = Policies.National)]
[Route("api/national")]
public class NationalController : ControllerBase
{
    private readonly NationalService _national;

    public NationalController(NationalService national) => _national = national;

    [HttpGet("nucleos")]
    public async Task<ActionResult<List<NucleoDto>>> Nucleos() => Ok(await _national.ListNucleosAsync());

    /// <summary>Nucleo novo, com quem vai administra-lo: devolve o link de primeiro acesso dessa pessoa.</summary>
    [HttpPost("nucleos")]
    public async Task<ActionResult<NucleoAdminResultDto>> CreateNucleo(CreateNucleoRequest request)
        => Ok(await _national.CreateNucleoAsync(request));

    [HttpPut("nucleos/{id:guid}")]
    public async Task<ActionResult<NucleoDto>> UpdateNucleo(Guid id, SaveNucleoRequest request)
        => Ok(await _national.UpdateNucleoAsync(id, request));

    [HttpPost("nucleos/{id:guid}/admins")]
    public async Task<ActionResult<NucleoAdminResultDto>> AddAdmin(Guid id, PersonRequest request)
        => Ok(await _national.AddAdminAsync(id, request));

    [HttpPost("nucleos/{id:guid}/admins/{userId:guid}/access-link")]
    public async Task<ActionResult<AccessLinkDto>> NewAdminLink(Guid id, Guid userId)
        => Ok(await _national.NewAdminLinkAsync(id, userId));

    [HttpGet("people")]
    public async Task<ActionResult<List<NationalPersonDto>>> People() => Ok(await _national.ListPeopleAsync());

    [HttpPost("people")]
    public async Task<ActionResult<NationalPersonResultDto>> AddPerson(PersonRequest request)
        => Ok(await _national.AddPersonAsync(request));

    [HttpDelete("people/{userId:guid}")]
    public async Task<IActionResult> RemovePerson(Guid userId)
    {
        await _national.RemovePersonAsync(userId);
        return NoContent();
    }

    [HttpPost("people/{userId:guid}/access-link")]
    public async Task<ActionResult<AccessLinkDto>> NewPersonLink(Guid userId)
        => Ok(await _national.NewPersonLinkAsync(userId));
}
