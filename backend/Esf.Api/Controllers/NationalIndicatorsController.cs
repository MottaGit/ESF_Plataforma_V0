using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Indicadores nacionais: todos os nucleos consultam (para escolher); so a gestao nacional altera.</summary>
[ApiController]
[Authorize]
[Route("api/national-indicators")]
public class NationalIndicatorsController : ControllerBase
{
    private readonly NationalIndicatorService _indicators;
    private readonly ICurrentUser _currentUser;

    public NationalIndicatorsController(NationalIndicatorService indicators, ICurrentUser currentUser)
    {
        _indicators = indicators;
        _currentUser = currentUser;
    }

    /// <summary>Os ativos; a gestao nacional pode pedir tambem os arquivados.</summary>
    [HttpGet]
    public async Task<ActionResult<List<NationalIndicatorDto>>> List([FromQuery] bool includeArchived = false)
        => Ok(await _indicators.ListAsync(includeArchived && _currentUser.IsNational));

    [HttpPost]
    [Authorize(Policy = Policies.National)]
    public async Task<ActionResult<NationalIndicatorDto>> Create(SaveNationalIndicatorRequest request)
        => Ok(await _indicators.CreateAsync(request));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.National)]
    public async Task<ActionResult<NationalIndicatorDto>> Update(Guid id, SaveNationalIndicatorRequest request)
        => Ok(await _indicators.UpdateAsync(id, request));

    [HttpPost("{id:guid}/archive")]
    [Authorize(Policy = Policies.National)]
    public async Task<ActionResult<NationalIndicatorDto>> Archive(Guid id)
        => Ok(await _indicators.SetArchivedAsync(id, true));

    [HttpPost("{id:guid}/unarchive")]
    [Authorize(Policy = Policies.National)]
    public async Task<ActionResult<NationalIndicatorDto>> Unarchive(Guid id)
        => Ok(await _indicators.SetArchivedAsync(id, false));
}
