using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Esf.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/search")]
public class SearchController : ControllerBase
{
    private readonly SearchService _search;

    public SearchController(SearchService search) => _search = search;

    /// <summary>Busca geral: projetos, programas, atividades, voluntarios e relatos (sem diferenciar acentos).</summary>
    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search([FromQuery] string? q) => Ok(await _search.SearchAsync(q));
}
