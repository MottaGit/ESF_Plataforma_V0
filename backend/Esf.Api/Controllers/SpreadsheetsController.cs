using Esf.Api.Common;
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

    /// <summary>Exporta o que foi escolhido (projetos, voluntarios ou os dois). Fica no historico de alteracoes.</summary>
    [HttpPost("export")]
    public async Task<IActionResult> Export(ExportSpreadsheetRequest request)
    {
        var (content, fileName) = await _spreadsheets.ExportAsync(request);
        return File(content, SpreadsheetService.ContentType, fileName);
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
    /// sem erro). Devolve o resultado de cada linha.
    /// </summary>
    [HttpPost("import")]
    [RequestSizeLimit(SpreadsheetImportService.MaxFileBytes + 1024 * 1024)]
    public async Task<ActionResult<ImportResultDto>> Import([FromForm] IFormFile? file, [FromQuery] bool confirm,
        [FromServices] SpreadsheetImportService import)
        => Ok(await import.ImportAsync(file, confirm));
}
