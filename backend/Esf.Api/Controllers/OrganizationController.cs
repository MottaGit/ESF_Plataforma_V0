using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/organization")]
public class OrganizationController : ControllerBase
{
    private readonly OrganizationService _organization;

    public OrganizationController(OrganizationService organization) => _organization = organization;

    /// <summary>Dados institucionais publicos (nome, CNPJ, contatos): a pagina de privacidade abre sem login.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<OrganizationDto>> Get() => Ok(await _organization.GetAsync());

    [HttpPut]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<OrganizationDto>> Update(SaveOrganizationRequest request)
        => Ok(await _organization.UpdateAsync(request));

    [HttpPost("logo")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<OrganizationDto>> UploadLogo([FromForm] IFormFile file)
        => Ok(await _organization.UpdateLogoAsync(file));
}
