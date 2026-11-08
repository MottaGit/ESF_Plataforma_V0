using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Esf.Api.Controllers;

/// <summary>
/// Termo de adesao do proprio voluntario (qualquer perfil com acesso ligado a um voluntario): ler, assinar online e
/// baixar a via assinada.
/// </summary>
[ApiController]
[Authorize]
[Route("api/me/term")]
public class MyTermController : ControllerBase
{
    private readonly MyTermService _term;
    private readonly ForwardedHeadersOptions _forwarded;

    public MyTermController(MyTermService term, IOptions<ForwardedHeadersOptions> forwarded)
    {
        _term = term;
        _forwarded = forwarded.Value;
    }

    [HttpGet]
    public async Task<ActionResult<MyTermDto>> Get() => Ok(await _term.GetAsync());

    [HttpPost("sign")]
    public async Task<ActionResult<MyTermDto>> Sign(SignTermRequest request)
    {
        // Endereco ja conferido pelo UseForwardedHeaders (ver ClientAddress), e nao a cadeia que o navegador mandou.
        var ip = ClientAddress.ForRecord(HttpContext, _forwarded.ForwardedForHeaderName);
        return Ok(await _term.SignAsync(request, ip, Request.Headers.UserAgent.ToString()));
    }

    [HttpGet("download")]
    public async Task<IActionResult> Download()
    {
        var (content, contentType, fileName) = await _term.DownloadAsync();
        return File(content, contentType, fileName);
    }
}
