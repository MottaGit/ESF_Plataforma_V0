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
            .Select(p => new ProgramDto(p.Id, p.Name, p.Status, p.CreatedAt))
            .ToListAsync();
    }

    public async Task<ProgramDto> CreateAsync(SaveProgramRequest request)
    {
        var name = request.Name.Trim();

        if (await _db.Programs.AnyAsync(p => EF.Functions.ILike(p.Name, name)))
            throw AppException.Conflict("Ja existe um programa com este nome.");

        var program = new ProjectProgram { Name = name };
        _db.Programs.Add(program);
        await _db.SaveChangesAsync();

        return new ProgramDto(program.Id, program.Name, program.Status, program.CreatedAt);
    }
}
