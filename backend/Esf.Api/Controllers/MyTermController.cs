using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    public MyTermController(MyTermService term) => _term = term;

    [HttpGet]
    public async Task<ActionResult<MyTermDto>> Get() => Ok(await _term.GetAsync());

    [HttpPost("sign")]
    public async Task<ActionResult<MyTermDto>> Sign(SignTermRequest request)
    {
        // Atras do proxy da hospedagem o endereco real vem em X-Forwarded-For; guarda a cadeia inteira.
        var forwarded = Request.Headers["X-Forwarded-For"].ToString();
        var ip = string.IsNullOrWhiteSpace(forwarded) ? HttpContext.Connection.RemoteIpAddress?.ToString() : forwarded;
        return Ok(await _term.SignAsync(request, ip, Request.Headers.UserAgent.ToString()));
    }

    [HttpGet("download")]
    public async Task<IActionResult> Download()
    {
        var (content, contentType, fileName) = await _term.DownloadAsync();
        return File(content, contentType, fileName);
    }
}
