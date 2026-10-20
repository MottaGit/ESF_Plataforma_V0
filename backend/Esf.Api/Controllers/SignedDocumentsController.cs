using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>
/// Termos de adesao e autorizacoes de uso de imagem. Trazem CPF, endereco e assinatura, por isso so a
/// coordenacao (administrador e coordenador) ve, envia e baixa.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.ManageProjects)]
[Route("api")]
public class SignedDocumentsController : ControllerBase
{
    private readonly SignedDocumentService _documents;

    public SignedDocumentsController(SignedDocumentService documents) => _documents = documents;

    [HttpGet("volunteers/{volunteerId:guid}/documents")]
    public async Task<ActionResult<List<SignedDocumentDto>>> ListForVolunteer(Guid volunteerId)
        => Ok(await _documents.ListForVolunteerAsync(volunteerId));

    [HttpPost("volunteers/{volunteerId:guid}/documents")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<SignedDocumentDto>> UploadForVolunteer(Guid volunteerId, [FromForm] UploadSignedDocumentRequest request)
        => Ok(await _documents.UploadForVolunteerAsync(volunteerId, request));

    /// <summary>Termo de adesao em PDF, com o nome do voluntario, para imprimir e assinar.</summary>
    [HttpGet("volunteers/{volunteerId:guid}/documents/template")]
    public async Task<IActionResult> VolunteerTermTemplate(Guid volunteerId)
    {
        var (content, fileName) = await _documents.VolunteerTermTemplateAsync(volunteerId);
        return File(content, "application/pdf", fileName);
    }

    [HttpGet("documents/{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var (content, contentType, fileName) = await _documents.GetDownloadAsync(id);
        return File(content, contentType, fileName);
    }

    [HttpDelete("documents/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _documents.DeleteAsync(id);
        return NoContent();
    }
}
