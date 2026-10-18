using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class ProgramService
{
    private readonly EsfDbContext _db;

    public ProgramService(EsfDbContext db) => _db = db;

    public async Task<List<ProgramDto>> ListAsync(bool onlyActive)
    {
        var query = _db.Programs.AsNoTracking();

        if (onlyActive)
            query = query.Where(p => p.Status == ProgramStatus.Ativo);

        return await query
            .OrderBy(p => p.Name)
            .Select(p => new ProgramDto(p.Id, p.Name, p.Status, p.CreatedAt, p.Projects.Count))
            .ToListAsync();
    }

    public async Task<ProgramDto> CreateAsync(SaveProgramRequest request)
    {
        var name = request.Name.Trim();
        await EnsureNameAvailableAsync(name, null);

        var program = new ProjectProgram { Name = name };
        _db.Programs.Add(program);
        await _db.SaveChangesAsync();

        return new ProgramDto(program.Id, program.Name, program.Status, program.CreatedAt, 0);
    }

    /// <summary>Renomeia e/ou arquiva o programa. Arquivado, ele some das opcoes de novos projetos.</summary>
    public async Task<ProgramDto> UpdateAsync(Guid id, UpdateProgramRequest request)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Programa");

        var name = request.Name.Trim();
        await EnsureNameAvailableAsync(name, id);

        program.Name = name;
        program.Status = request.Status!.Value;
        await _db.SaveChangesAsync();

        var projects = await _db.Projects.CountAsync(p => p.ProgramId == id);
        return new ProgramDto(program.Id, program.Name, program.Status, program.CreatedAt, projects);
    }

    /// <summary>So exclui programa sem projetos (criado por engano, por exemplo); com projetos, arquive.</summary>
    public async Task DeleteAsync(Guid id)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id) ?? throw AppException.NotFound("Programa");

        if (await _db.Projects.AnyAsync(p => p.ProgramId == id))
            throw AppException.Conflict("Este programa tem projetos. Arquive-o em vez de excluir.");

        _db.Programs.Remove(program);
        await _db.SaveChangesAsync();
    }

    private async Task EnsureNameAvailableAsync(string name, Guid? exceptId)
    {
        if (await _db.Programs.AnyAsync(p => p.Id != exceptId && EF.Functions.ILike(p.Name, name)))
            throw AppException.Conflict("Ja existe um programa com este nome.");
    }
}
