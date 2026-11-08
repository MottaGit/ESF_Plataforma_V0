using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Esf.Api.Controllers;

/// <summary>Paginas publicas (sem login), abertas por um link que a coordenacao liga e desliga.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/public")]
public class PublicController : ControllerBase
{
    private readonly PublicProgramService _programs;

    public PublicController(PublicProgramService programs) => _programs = programs;

    /// <summary>Pagina publica de um programa, pelo codigo do link.</summary>
    [HttpGet("programs/{token}")]
    [EnableRateLimiting(PublicProgramService.RateLimitPolicy)]
    public async Task<ActionResult<PublicProgramDto>> Program(string token) => Ok(await _programs.GetAsync(token));
}
