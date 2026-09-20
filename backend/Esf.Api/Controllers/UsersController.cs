using Esf.Api.Common;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly UserService _users;
    private readonly ICurrentUser _currentUser;

    public UsersController(UserService users, ICurrentUser currentUser)
    {
        _users = users;
        _currentUser = currentUser;
    }

    /// <summary>Lista usada tambem para selecionar responsaveis por projetos e atividades.</summary>
    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> List([FromQuery] bool onlyActive = false)
        => Ok(await _users.ListAsync(onlyActive));

    [HttpPost]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest request)
        => Ok(await _users.CreateAsync(request));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<ActionResult<UserDto>> Update(Guid id, UpdateUserRequest request)
        => Ok(await _users.UpdateAsync(id, request, _currentUser.RequireId()));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.AdminOnly)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _users.DeleteAsync(id, _currentUser.RequireId());
        return NoContent();
    }
}
