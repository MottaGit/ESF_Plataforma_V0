using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

/// <summary>Configuracoes › Google Drive: ligar o nucleo a uma pasta do Drive, acompanhar e desligar. So administradores.</summary>
[ApiController]
[Authorize(Policy = Policies.AdminOnly)]
[Route("api/drive")]
public class DriveController : ControllerBase
{
    private readonly DriveSettingsService _drive;

    public DriveController(DriveSettingsService drive) => _drive = drive;

    [HttpGet]
    public Task<DriveStatusDto> Get() => _drive.GetAsync();

    /// <summary>Liga (ou troca) a pasta da plataforma; os projetos em aberto ganham pasta em seguida.</summary>
    [HttpPut]
    public Task<DriveStatusDto> Connect(ConnectDriveRequest request) => _drive.ConnectAsync(request);

    /// <summary>Desliga. O que ja foi criado no Drive fica la.</summary>
    [HttpDelete]
    public async Task<IActionResult> Disconnect()
    {
        await _drive.DisconnectAsync();
        return NoContent();
    }

    /// <summary>Poe de volta na fila o que parou depois de muitas tentativas.</summary>
    [HttpPost("retry")]
    public Task<DriveStatusDto> Retry() => _drive.RetryAsync();
}
