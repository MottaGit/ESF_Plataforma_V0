using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Esf.Api.Controllers;

/// <summary>Acesso por link: a administracao gera, a pessoa abre e cria a propria senha.</summary>
[ApiController]
[Route("api")]
public class AccessController : ControllerBase
{
    private readonly AccessService _access;

    public AccessController(AccessService access) => _access = access;

    /// <summary>Da acesso a um voluntario (login = e-mail do cadastro) e devolve o link de primeiro acesso.</summary>
    [HttpPost("volunteers/{id:guid}/access")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<AccessLinkDto>> Grant(Guid id, GrantAccessRequest request)
        => Ok(await _access.GrantAsync(id, request.Role!.Value));

    /// <summary>Link novo para um acesso existente; os links anteriores ainda nao usados deixam de valer.</summary>
    [HttpPost("users/{id:guid}/access-link")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<AccessLinkDto>> NewLink(Guid id)
        => Ok(await _access.NewLinkAsync(id));

    [HttpGet("access/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting(AccessService.RateLimitPolicy)]
    public async Task<ActionResult<AccessLinkInfoDto>> Info(string token)
        => Ok(await _access.GetInfoAsync(token));

    [HttpPost("access/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting(AccessService.RateLimitPolicy)]
    public async Task<ActionResult<LoginResponse>> Use(string token, UseAccessLinkRequest request)
        => Ok(await _access.UseAsync(token, request));
}
