using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Planilha de programas, projetos e voluntarios: exportar, baixar o modelo e importar. So administradores.</summary>
[ApiController]
[Authorize(Policy = Policies.AdminOnly)]
[Route("api/spreadsheets")]
public class SpreadsheetsController : ControllerBase
{
    private readonly SpreadsheetService _spreadsheets;

    public SpreadsheetsController(SpreadsheetService spreadsheets) => _spreadsheets = spreadsheets;

    /// <summary>
    /// Pede a exportacao do que foi escolhido (projetos, voluntarios ou os dois): responde 202 com a tarefa em segundo
    /// plano; o arquivo sai em /api/jobs/{id}/download. Fica no historico de alteracoes.
    /// </summary>
    [HttpPost("export")]
    public async Task<ActionResult<BackgroundJobDto>> Export(ExportSpreadsheetRequest request, [FromServices] JobQueue jobs)
    {
        SpreadsheetService.CheckExport(request);
        var job = await jobs.EnqueueAsync(BackgroundJobKind.SpreadsheetExport, request);
        return Accepted($"/api/jobs/{job.Id}", job);
    }

    /// <summary>Modelo vazio de importacao, com as listas do nucleo e as instrucoes de preenchimento.</summary>
    [HttpGet("template")]
    public async Task<IActionResult> Template()
    {
        var (content, fileName) = await _spreadsheets.TemplateAsync();
        return File(content, SpreadsheetService.ContentType, fileName);
    }

    /// <summary>
    /// Confere a planilha preenchida (confirm = false: nada e gravado) ou importa (confirm = true: cria o que e novo e
    /// sem erro), em segundo plano: responde 202 com a tarefa, e o resultado de cada linha vem em result.
    /// </summary>
    [HttpPost("import")]
    [RequestSizeLimit(SpreadsheetImportService.MaxFileBytes + 1024 * 1024)]
    public async Task<ActionResult<BackgroundJobDto>> Import([FromForm] IFormFile? file, [FromQuery] bool confirm,
        [FromServices] JobQueue jobs)
    {
        SpreadsheetImportService.CheckFile(file);
        var job = await jobs.EnqueueAsync(BackgroundJobKind.SpreadsheetImport,
            new SpreadsheetImportJob(confirm, Path.GetFileName(file!.FileName)), file);
        return Accepted($"/api/jobs/{job.Id}", job);
    }
}
