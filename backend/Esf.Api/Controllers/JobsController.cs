using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Tarefas em segundo plano de quem esta logado (relatorios, planilhas): situacao e download.</summary>
[ApiController]
[Authorize]
[Route("api/jobs")]
public class JobsController : ControllerBase
{
    private readonly JobQueue _jobs;

    public JobsController(JobQueue jobs) => _jobs = jobs;

    /// <summary>As recentes (ultimos 7 dias), as mais novas primeiro; kind filtra pelo tipo (pode repetir).</summary>
    [HttpGet]
    public async Task<ActionResult<List<BackgroundJobDto>>> List([FromQuery] List<BackgroundJobKind>? kind) =>
        await _jobs.ListMineAsync(kind ?? new List<BackgroundJobKind>());

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BackgroundJobDto>> Get(Guid id) => await _jobs.GetAsync(id);

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var (content, contentType, fileName) = await _jobs.DownloadAsync(id);
        return File(content, contentType, fileName);
    }
}
