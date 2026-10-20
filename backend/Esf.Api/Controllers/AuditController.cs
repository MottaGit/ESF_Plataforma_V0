using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Historico de alteracoes: quem mudou o que e quando. So administradores.</summary>
[ApiController]
[Authorize(Policy = Policies.AdminOnly)]
[Route("api/audit")]
public class AuditController : ControllerBase
{
    private readonly AuditService _audit;

    public AuditController(AuditService audit) => _audit = audit;

    /// <summary>50 por pagina, mais recentes primeiro; filtros por projeto, pessoa, tipo e periodo.</summary>
    [HttpGet]
    public async Task<ActionResult<AuditPageDto>> List([FromQuery] AuditQuery query) => Ok(await _audit.ListAsync(query));
}
