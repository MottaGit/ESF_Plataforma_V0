using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Gestao nacional: cadastra nucleos e quem os administra (por link de primeiro acesso) e cuida das pessoas da
/// propria gestao nacional. Trabalha sobre todos os nucleos, mas so com dados de gestao: nada de voluntarios,
/// projetos ou registros dos nucleos alem de contagens.
/// </summary>
public class NationalService
{
    private readonly EsfDbContext _db;
    private readonly AccessService _access;
    private readonly ICurrentUser _currentUser;

    public NationalService(EsfDbContext db, AccessService access, ICurrentUser currentUser)
    {
        _db = db;
        _access = access;
        _currentUser = currentUser;
        // So usado nas rotas da gestao nacional (politica National): ve todos os nucleos.
        _db.AllOrganizations = true;
    }

    public async Task<List<NucleoDto>> ListNucleosAsync()
    {
        var nucleos = await _db.Organizations.AsNoTracking().OrderBy(o => o.Name).ToListAsync();
        var volunteers = await _db.Volunteers
            .Where(v => v.Status == VolunteerStatus.Ativo && v.AnonymizedAt == null)
            .GroupBy(v => v.OrganizationId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var projects = await _db.Projects
            .Where(p => !p.IsArchived && (p.Status == ProjectStatus.Planejamento || p.Status == ProjectStatus.EmAndamento))
            .GroupBy(p => p.OrganizationId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var admins = await AdminsAsync(null);

        return nucleos.Select(o => new NucleoDto(o.Id, o.Name, o.City, o.State,
                volunteers.GetValueOrDefault(o.Id), projects.GetValueOrDefault(o.Id),
                admins.Where(a => a.OrganizationId == o.Id).Select(a => a.Admin).ToList()))
            .ToList();
    }

    /// <summary>
    /// Painel nacional: por nucleo e no total, so numeros. Tarefas concluidas, registros e horas de voluntariado
    /// contam no periodo; projetos, voluntarios ativos e indicadores nacionais sao a situacao de hoje (os indicadores
    /// nao guardam historico), somando os projetos nao arquivados pelo vinculo com o indicador nacional.
    /// </summary>
    public async Task<NationalPanelDto> PanelAsync(DateOnly? from, DateOnly? to)
    {
        if (from.HasValue && to.HasValue && to < from)
            throw new AppException("O fim do periodo nao pode ser antes do inicio.");
        var fromUtc = from?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toUtc = to?.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var nucleos = await _db.Organizations.AsNoTracking().OrderBy(o => o.Name).ToListAsync();

        var projects = await _db.Projects
            .Where(p => !p.IsArchived)
            .GroupBy(p => new { p.OrganizationId, p.Status })
            .Select(g => new { g.Key.OrganizationId, g.Key.Status, Count = g.Count() })
            .ToListAsync();
        int ProjectsOf(Guid id, params ProjectStatus[] statuses) =>
            projects.Where(p => p.OrganizationId == id && statuses.Contains(p.Status)).Sum(p => p.Count);

        var volunteers = await _db.Volunteers
            .Where(v => v.Status == VolunteerStatus.Ativo && v.AnonymizedAt == null)
            .GroupBy(v => v.OrganizationId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        // Horas: dias como Ativo no periodo, de cada voluntario (inclusive quem ja saiu), somados por nucleo.
        var nucleoOfVolunteer = await _db.Volunteers.Select(v => new { v.Id, v.OrganizationId })
            .ToDictionaryAsync(v => v.Id, v => v.OrganizationId);
        var changes = await _db.VolunteerStatusChanges.AsNoTracking().OrderBy(c => c.StartsOn).ToListAsync();
        var activeDays = changes
            .GroupBy(c => c.VolunteerId)
            .Where(g => nucleoOfVolunteer.ContainsKey(g.Key))
            .GroupBy(g => nucleoOfVolunteer[g.Key])
            .ToDictionary(g => g.Key, g => g.Sum(volunteer =>
                VolunteerStatusHistoryService.ActiveDays(volunteer.ToList(), from, to)));

        var tasks = await _db.Activities
            .Where(a => a.CompletedAt != null
                        && (fromUtc == null || a.CompletedAt >= fromUtc)
                        && (toUtc == null || a.CompletedAt < toUtc))
            .GroupBy(a => a.Project!.OrganizationId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var records = await _db.ProjectUpdates
            .Where(u => (fromUtc == null || u.CreatedAt >= fromUtc) && (toUtc == null || u.CreatedAt < toUtc))
            .GroupBy(u => u.Project!.OrganizationId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var lastRecord = await _db.ProjectUpdates
            .GroupBy(u => u.Project!.OrganizationId)
            .Select(g => new { g.Key, Last = g.Max(u => u.CreatedAt) })
            .ToDictionaryAsync(x => x.Key, x => x.Last);
        var lastTask = await _db.Activities
            .Where(a => a.CompletedAt != null)
            .GroupBy(a => a.Project!.OrganizationId)
            .Select(g => new { g.Key, Last = g.Max(a => a.CompletedAt) })
            .ToDictionaryAsync(x => x.Key, x => x.Last);

        var values = await _db.Indicators
            .Where(i => i.NationalIndicatorId != null && !i.Project!.IsArchived)
            .GroupBy(i => new { i.Project!.OrganizationId, NationalId = i.NationalIndicatorId!.Value })
            .Select(g => new { g.Key.OrganizationId, g.Key.NationalId, Total = g.Sum(i => i.Value ?? 0) })
            .ToListAsync();
        // Ativos, mais os arquivados que ainda tem valor registrado.
        var nationals = await _db.NationalIndicators.AsNoTracking().OrderBy(n => n.Name).ToListAsync();
        nationals = nationals.Where(n => !n.IsArchived || values.Any(v => v.NationalId == n.Id)).ToList();

        var rows = nucleos.Select(o =>
        {
            var moments = new List<DateTime>();
            if (lastRecord.TryGetValue(o.Id, out var record)) moments.Add(record);
            if (lastTask.TryGetValue(o.Id, out var task) && task.HasValue) moments.Add(task.Value);
            DateTime? lastActivity = moments.Count > 0 ? moments.Max() : null;

            return new NationalNucleoRowDto(o.Id, o.Name, o.City, o.State,
                ProjectsOf(o.Id, ProjectStatus.Planejamento, ProjectStatus.EmAndamento),
                ProjectsOf(o.Id, ProjectStatus.Concluido),
                volunteers.GetValueOrDefault(o.Id),
                VolunteerStatusHistoryService.HoursFor(activeDays.GetValueOrDefault(o.Id)),
                tasks.GetValueOrDefault(o.Id),
                records.GetValueOrDefault(o.Id),
                lastActivity,
                values.Where(v => v.OrganizationId == o.Id).ToDictionary(v => v.NationalId, v => v.Total));
        }).ToList();

        var totals = new NationalTotalsDto(
            nucleos.Count,
            rows.Sum(r => r.ActiveProjects),
            rows.Sum(r => r.ConcludedProjects),
            rows.Sum(r => r.ActiveVolunteers),
            rows.Sum(r => r.VolunteerHours),
            rows.Sum(r => r.TasksCompleted),
            rows.Sum(r => r.Records));

        var indicatorTotals = nationals
            .Select(n => new NationalIndicatorTotalDto(n.Id, n.Name, n.Unit,
                values.Where(v => v.NationalId == n.Id).Sum(v => v.Total)))
            .ToList();

        return new NationalPanelDto(from, to, totals, indicatorTotals, rows);
    }

    /// <summary>Nucleo novo, ja com quem vai administra-lo (entra como voluntario do nucleo e recebe o link).</summary>
    public async Task<NucleoAdminResultDto> CreateNucleoAsync(CreateNucleoRequest request)
    {
        var nucleo = new Organization { UpdatedAt = DateTime.UtcNow };
        await ApplyAsync(nucleo, request);
        _db.Organizations.Add(nucleo);
        await _db.SaveChangesAsync();

        var link = await AddAdminAsync(nucleo, request.AdminName, request.AdminEmail);
        return new NucleoAdminResultDto(await GetNucleoAsync(nucleo.Id), link);
    }

    public async Task<NucleoDto> UpdateNucleoAsync(Guid id, SaveNucleoRequest request)
    {
        var nucleo = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id) ?? throw AppException.NotFound("Nucleo");
        await ApplyAsync(nucleo, request);
        nucleo.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await GetNucleoAsync(id);
    }

    /// <summary>Mais um administrador para um nucleo (por exemplo, quando quem administrava saiu).</summary>
    public async Task<NucleoAdminResultDto> AddAdminAsync(Guid nucleoId, PersonRequest request)
    {
        var nucleo = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == nucleoId) ?? throw AppException.NotFound("Nucleo");
        var link = await AddAdminAsync(nucleo, request.Name, request.Email);
        return new NucleoAdminResultDto(await GetNucleoAsync(nucleoId), link);
    }

    /// <summary>Link novo para um administrador de nucleo (perdeu o primeiro acesso ou esqueceu a senha).</summary>
    public async Task<AccessLinkDto> NewAdminLinkAsync(Guid nucleoId, Guid userId)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId && u.OrganizationId == nucleoId && u.Role == UserRole.Administrador))
            throw AppException.NotFound("Administrador");
        return await _access.NewLinkAsync(userId);
    }

    public async Task<List<NationalPersonDto>> ListPeopleAsync()
    {
        var names = await _db.Organizations.ToDictionaryAsync(o => o.Id, o => o.Name);
        var people = await _db.Users.AsNoTracking().Include(u => u.Volunteer)
            .Where(u => u.IsNational)
            .OrderBy(u => u.Name)
            .ToListAsync();
        return people.Select(u => ToPerson(u, names)).ToList();
    }

    /// <summary>
    /// Inclui alguem na gestao nacional. Se o e-mail ja e de um acesso de nucleo, ele ganha a permissao (entra com a
    /// mesma senha); se nao, nasce uma conta so nacional, com link de primeiro acesso.
    /// </summary>
    public async Task<NationalPersonResultDto> AddPersonAsync(PersonRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var names = await _db.Organizations.ToDictionaryAsync(o => o.Id, o => o.Name);
        var user = await _db.Users.Include(u => u.Volunteer).FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user is not null)
        {
            if (user.IsNational) throw AppException.Conflict("Esta pessoa ja faz parte da gestao nacional.");
            if (!user.IsActive) throw new AppException("Este acesso esta desativado. Peca ao nucleo para reativar antes.");
            user.IsNational = true;
            await _db.SaveChangesAsync();
            return new NationalPersonResultDto(ToPerson(user, names), null);
        }

        user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = string.Empty,
            Role = UserRole.Usuario,
            IsActive = true,
            IsNational = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var link = await _access.NewLinkAsync(user.Id);
        return new NationalPersonResultDto(ToPerson(user, names), link);
    }

    /// <summary>Tira alguem da gestao nacional; a conta so nacional fica desativada (sem a permissao, nao serve).</summary>
    public async Task RemovePersonAsync(Guid userId)
    {
        if (userId == _currentUser.Id)
            throw new AppException("Voce nao pode tirar a propria permissao da gestao nacional.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsNational)
                   ?? throw AppException.NotFound("Pessoa da gestao nacional", feminine: true);
        user.IsNational = false;
        if (user.OrganizationId is null) user.IsActive = false;
        await _db.SaveChangesAsync();
    }

    /// <summary>Link novo para uma conta so nacional (a de quem e de um nucleo, o proprio nucleo gera).</summary>
    public async Task<AccessLinkDto> NewPersonLinkAsync(Guid userId)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId && u.IsNational && u.OrganizationId == null))
            throw AppException.NotFound("Conta da gestao nacional", feminine: true);
        return await _access.NewLinkAsync(userId);
    }

    /// <summary>
    /// Conta inicial da gestao nacional (Nacional__AdminEmail e Nacional__AdminPassword), na subida do servidor e so
    /// enquanto nao existe nenhuma: se o e-mail ja for de um acesso, ele ganha a permissao; se nao, nasce a conta.
    /// </summary>
    public static async Task EnsureInitialAccountAsync(EsfDbContext db, NationalOptions options, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(options.AdminEmail)) return;

        db.AllOrganizations = true;
        if (await db.Users.AnyAsync(u => u.IsNational)) return;

        var email = options.AdminEmail.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        if (user is not null)
        {
            user.IsNational = true;
            await db.SaveChangesAsync();
            logger.LogInformation("Permissao da gestao nacional dada ao acesso {Email}.", email);
            return;
        }

        if (string.IsNullOrEmpty(options.AdminPassword) || options.AdminPassword.Length < 6)
        {
            logger.LogWarning("Nacional:AdminPassword ausente ou com menos de 6 caracteres: a conta nacional nao foi criada.");
            return;
        }

        db.Users.Add(new User
        {
            Name = string.IsNullOrWhiteSpace(options.AdminName) ? "Gestão nacional" : options.AdminName.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(options.AdminPassword),
            Role = UserRole.Usuario,
            IsActive = true,
            IsNational = true
        });
        await db.SaveChangesAsync();
        logger.LogInformation("Conta inicial da gestao nacional criada: {Email}.", email);
    }

    /// <summary>
    /// Administrador do nucleo. Ja tem acesso no nucleo: passa a administrador (entra com a senha que ja tem). Ja e
    /// voluntario do nucleo: ganha o acesso. Senao, entra como voluntario novo. Nos dois ultimos casos sai o link.
    /// </summary>
    private async Task<AccessLinkDto?> AddAdminAsync(Organization nucleo, string name, string emailInput)
    {
        var email = emailInput.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        if (user is not null)
        {
            if (user.OrganizationId != nucleo.Id)
                throw AppException.Conflict("Este e-mail ja e o login de outra pessoa na plataforma.");
            user.Role = UserRole.Administrador;
            user.IsActive = true;
            await _db.SaveChangesAsync();
            return null;
        }

        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v =>
            v.OrganizationId == nucleo.Id && v.AnonymizedAt == null && v.Email != null && v.Email.ToLower() == email);
        if (volunteer is null)
        {
            volunteer = new Volunteer
            {
                OrganizationId = nucleo.Id,
                Name = name.Trim(),
                Email = email,
                Sector = VolunteerSector.Projetos,
                Status = VolunteerStatus.Ativo,
                CreatedAt = DateTime.UtcNow
            };
            _db.Volunteers.Add(volunteer);
            VolunteerStatusHistoryService.Start(_db, volunteer, Mapping.Today);
            await _db.SaveChangesAsync();
        }

        return await _access.GrantAsync(volunteer.Id, UserRole.Administrador);
    }

    private async Task ApplyAsync(Organization nucleo, SaveNucleoRequest request)
    {
        var name = request.Name.Trim();
        if (await _db.Organizations.AnyAsync(o => o.Id != nucleo.Id && o.Name.ToLower() == name.ToLower()))
            throw AppException.Conflict("Ja existe um nucleo com este nome.");

        nucleo.Name = name;
        nucleo.City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim();
        nucleo.State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim();
    }

    private async Task<NucleoDto> GetNucleoAsync(Guid id) =>
        (await ListNucleosAsync()).First(n => n.Id == id);

    private async Task<List<(Guid? OrganizationId, NucleoAdminDto Admin)>> AdminsAsync(Guid? nucleoId)
    {
        var admins = await _db.Users.AsNoTracking().Include(u => u.Volunteer)
            .Where(u => u.OrganizationId != null && u.Role == UserRole.Administrador)
            .Where(u => nucleoId == null || u.OrganizationId == nucleoId)
            .OrderBy(u => u.Name)
            .ToListAsync();
        return admins
            .Select(u => (u.OrganizationId,
                new NucleoAdminDto(u.Id, u.Volunteer?.Name ?? u.Name, u.Email, u.PasswordHash.Length == 0, u.IsActive)))
            .ToList();
    }

    private NationalPersonDto ToPerson(User u, Dictionary<Guid, string> nucleoNames) =>
        new(u.Id,
            u.Volunteer?.Name ?? u.Name,
            u.Email,
            u.OrganizationId.HasValue ? nucleoNames.GetValueOrDefault(u.OrganizationId.Value) : null,
            u.PasswordHash.Length == 0,
            u.IsActive,
            u.Id == _currentUser.Id);
}
