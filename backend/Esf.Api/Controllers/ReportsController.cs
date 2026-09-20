using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly ReportService _reports;
    private readonly ICurrentUser _currentUser;

    public ReportsController(ReportService reports, ICurrentUser currentUser)
    {
        _reports = reports;
        _currentUser = currentUser;
    }

    /// <summary>Gera um relatorio consolidado em PDF para um ou mais projetos.</summary>
    [HttpPost("projects")]
    public async Task<IActionResult> Projects(ReportRequest request)
    {
        var (content, fileName) = await _reports.GenerateAsync(request, _currentUser.Name ?? "usuario da plataforma");
        return File(content, "application/pdf", fileName);
    }
}
