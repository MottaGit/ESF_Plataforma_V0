using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboard;
    private readonly ICurrentUser _currentUser;

    public DashboardController(DashboardService dashboard, ICurrentUser currentUser)
    {
        _dashboard = dashboard;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get() => Ok(await _dashboard.GetAsync(_currentUser.Id));
}
