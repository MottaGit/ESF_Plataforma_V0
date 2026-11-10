using Esf.Api.Domain;
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
    private readonly JobQueue _jobs;

    public ReportsController(ReportService reports, JobQueue jobs)
    {
        _reports = reports;
        _jobs = jobs;
    }

    /// <summary>O que cada projeto tem no periodo (registros, fotos do PDF, tarefas concluidas), para escolher antes de gerar.</summary>
    [HttpGet("period-counts")]
    public async Task<ActionResult<List<ReportPeriodCountDto>>> PeriodCounts([FromQuery] DateOnly? from, [FromQuery] DateOnly? to) =>
        await _reports.PeriodCountsAsync(from, to);

    /// <summary>
    /// Pede o relatorio em PDF de um ou mais projetos. Responde na hora com a tarefa (202); o PDF e montado em segundo
    /// plano e baixado em /api/jobs/{id}/download quando a tarefa ficar pronta.
    /// </summary>
    [HttpPost("projects")]
    public async Task<ActionResult<BackgroundJobDto>> Projects(ReportRequest request)
    {
        await _reports.ValidateAsync(request);
        var job = await _jobs.EnqueueAsync(BackgroundJobKind.Report, request);
        return Accepted($"/api/jobs/{job.Id}", job);
    }
}
