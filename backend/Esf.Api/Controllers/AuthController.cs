using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly ICurrentUser _currentUser;

    public AuthController(AuthService auth, ICurrentUser currentUser)
    {
        _auth = auth;
        _currentUser = currentUser;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
        => Ok(await _auth.LoginAsync(request));

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
        => Ok(await _auth.MeAsync(_currentUser.RequireId()));

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        await _auth.ChangePasswordAsync(_currentUser.RequireId(), request);
        return NoContent();
    }
}
