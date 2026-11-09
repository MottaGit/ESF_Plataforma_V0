using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

public class VolunteerService
{
    private static readonly HashSet<string> PhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    /// <summary>Caractere de escape do padrao de busca (o mesmo de SearchText.ContainsPattern).</summary>
    private const string SearchEscape = "\\";

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;
    private readonly NotificationService _notifications;
    private readonly ICurrentUser? _currentUser;

    public VolunteerService(EsfDbContext db, FileStorageService storage, NotificationService notifications,
        ICurrentUser? currentUser = null)
    {
        _db = db;
        _storage = storage;
        _notifications = notifications;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Tarefas em aberto que contam como carga da pessoa: as de projetos em planejamento ou em andamento, nao
    /// arquivados (o mesmo recorte do Inicio, da escolha do responsavel e da saida do nucleo).
    /// </summary>
    private IQueryable<Activity> OpenTasksOf(Guid volunteerId) =>
        _db.Activities.Where(a => a.AssignedVolunteerId == volunteerId
                                  && a.Status != ActivityStatus.Concluida
                                  && !a.Project!.IsArchived
                                  && (a.Project.Status == ProjectStatus.Planejamento
                                      || a.Project.Status == ProjectStatus.EmAndamento));

    public async Task<List<VolunteerDto>> ListAsync(string? search, bool onlyActive, VolunteerSector? sector)
    {
        var query = _db.Volunteers.AsNoTracking();

        if (onlyActive)
            query = query.Where(v => v.Status == VolunteerStatus.Ativo);

        if (sector.HasValue)
            query = query.Where(v => v.Sector == sector.Value);

        // Sem diferenciar maiusculas nem acentos ("joao" acha "Joao"), como a busca geral; olha tambem as
        // competencias, para achar quem sabe AutoCAD.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = SearchText.ContainsPattern(SearchText.Fold(search.Trim()));
            query = query.Where(v =>
                EF.Functions.Like(EsfDbContext.Fold(v.Name), pattern, SearchEscape)
                || (v.Email != null && EF.Functions.Like(EsfDbContext.Fold(v.Email), pattern, SearchEscape))
                || (v.Skills != null && EF.Functions.Like(EsfDbContext.Fold(v.Skills), pattern, SearchEscape)));
        }

        return await query
            .OrderBy(v => v.Name)
            .Select(v => new VolunteerDto(
                v.Id,
                v.Name,
                v.Email,
                v.Phone,
                v.Sector,
                v.Skills,
                v.Notes,
                v.Status,
                v.Projects.Select(pv => new VolunteerProjectDto(
                    pv.ProjectId,
                    pv.Project!.Name,
                    pv.Project!.Status,
                    pv.Project!.Program!.Name,
                    pv.RoleInProject)).ToList(),
                v.CreatedAt,
                v.BirthDay,
                v.BirthMonth,
                v.PhotoStoredName != null ? Mapping.UploadsUrlPrefix + "/" + v.PhotoStoredName : null,
                _db.SignedDocuments
                    .Where(d => d.VolunteerId == v.Id && d.Kind == SignedDocumentKind.VolunteerTerm)
                    .Max(d => (DateOnly?)d.SignedOn),
                v.AnonymizedAt != null,
                _db.Users
                    .Where(u => u.VolunteerId == v.Id)
                    .Select(u => new VolunteerAccessDto(u.Id, u.Role, u.IsActive, u.PasswordHash == "",
                        _db.AccessLinks.Where(l => l.UserId == u.Id && l.UsedAt == null).Max(l => (DateTime?)l.ExpiresAt)))
                    .FirstOrDefault()))
            .ToListAsync();
    }

    /// <summary>
    /// Situacao e tarefas em aberto de cada voluntario (os anonimizados ficam de fora). Conta como o Inicio: so
    /// projetos em planejamento ou em andamento, nao arquivados.
    /// </summary>
    public async Task<List<VolunteerLoadDto>> LoadAsync()
    {
        var today = Mapping.Today;
        var open = await _db.Activities
            .Where(a => a.AssignedVolunteerId != null
                        && a.Status != ActivityStatus.Concluida
                        && !a.Project!.IsArchived
                        && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento))
            .GroupBy(a => a.AssignedVolunteerId!.Value)
            .Select(g => new
            {
                g.Key,
                Open = g.Count(),
                Late = g.Count(a => a.DueDate.HasValue && a.DueDate.Value < today)
            })
            .ToDictionaryAsync(x => x.Key, x => (x.Open, x.Late));

        var volunteers = await _db.Volunteers
            .AsNoTracking()
            .Where(v => v.AnonymizedAt == null)
            .Select(v => new { v.Id, v.Status })
            .ToListAsync();

        return volunteers.Select(v =>
        {
            var (openCount, lateCount) = open.GetValueOrDefault(v.Id);
            return new VolunteerLoadDto(v.Id, v.Status, openCount, lateCount);
        }).ToList();
    }

    public async Task<VolunteerDto> GetAsync(Guid id)
    {
        var volunteer = await _db.Volunteers
            .AsNoTracking()
            .Include(v => v.Projects).ThenInclude(pv => pv.Project).ThenInclude(p => p!.Program)
            .FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");

        var projects = volunteer.Projects.Select(Mapping.ToProjectDto).ToList();
        return Mapping.ToDto(volunteer, projects, await TermSignedOnAsync(id), await AccessOfAsync(id));
    }

    /// <summary>Depois de anonimizado, o cadastro nao volta a receber dados pessoais.</summary>
    private static void EnsureNotAnonymized(Volunteer volunteer)
    {
        if (volunteer.AnonymizedAt.HasValue)
            throw new AppException("Os dados deste voluntário foram anonimizados e não podem mais ser editados.");
    }

    /// <summary>Data do termo de adesao assinado mais recente (null: pendente).</summary>
    private Task<DateOnly?> TermSignedOnAsync(Guid volunteerId) =>
        _db.SignedDocuments
            .Where(d => d.VolunteerId == volunteerId && d.Kind == SignedDocumentKind.VolunteerTerm)
            .MaxAsync(d => (DateOnly?)d.SignedOn);

    /// <summary>Acesso a plataforma ligado ao voluntario (null: sem acesso).</summary>
    private Task<VolunteerAccessDto?> AccessOfAsync(Guid volunteerId) =>
        _db.Users.AsNoTracking()
            .Where(u => u.VolunteerId == volunteerId)
            .Select(u => new VolunteerAccessDto(u.Id, u.Role, u.IsActive, u.PasswordHash == "",
                _db.AccessLinks.Where(l => l.UserId == u.Id && l.UsedAt == null).Max(l => (DateTime?)l.ExpiresAt)))
            .FirstOrDefaultAsync();

    public async Task<VolunteerDto> CreateAsync(SaveVolunteerRequest request)
    {
        ValidateBirthday(request);
        if (request.ActiveSince > Mapping.Today)
            throw new AppException("A data de entrada no núcleo não pode ser depois de hoje.");
        var volunteer = new Volunteer();
        Apply(volunteer, request);
        volunteer.CreatedAt = DateTime.UtcNow;

        _db.Volunteers.Add(volunteer);
        // Quem ja estava no nucleo antes do cadastro nao comeca com as horas zeradas.
        VolunteerStatusHistoryService.Start(_db, volunteer, request.ActiveSince ?? Mapping.Today);
        await _db.SaveChangesAsync();

        return Mapping.ToDto(volunteer, new List<VolunteerProjectDto>());
    }

    public async Task<VolunteerDto> UpdateAsync(Guid id, SaveVolunteerRequest request)
    {
        ValidateBirthday(request);
        var volunteer = await _db.Volunteers
            .Include(v => v.Projects).ThenInclude(pv => pv.Project).ThenInclude(p => p!.Program)
            .FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");

        EnsureNotAnonymized(volunteer);
        var previousStatus = volunteer.Status;
        var previousEmail = volunteer.Email;
        Apply(volunteer, request);
        await SyncAccessAsync(volunteer, previousEmail);
        // Mudou a situacao pelo cadastro: entra no historico a partir de hoje.
        if (volunteer.Status != previousStatus)
            await VolunteerStatusHistoryService.ApplyPeriodAsync(_db, volunteer, volunteer.Status, Mapping.Today, null);
        // Saiu do nucleo: o formulario pergunta se o acesso fica desativado e se as tarefas ficam sem responsavel.
        // Tudo no mesmo SaveChanges da situacao.
        if (volunteer.Status is VolunteerStatus.Inativo or VolunteerStatus.ExMembro)
        {
            if (request.DeactivateAccess) await DeactivateAccessAsync(volunteer.Id);
            if (request.ReleaseTasks)
                foreach (var task in await OpenTasksOf(volunteer.Id).ToListAsync())
                    task.AssignedVolunteerId = null;
        }
        await _db.SaveChangesAsync();

        var projects = volunteer.Projects.Select(Mapping.ToProjectDto).ToList();
        return Mapping.ToDto(volunteer, projects, await TermSignedOnAsync(id), await AccessOfAsync(id));
    }

    /// <summary>
    /// Desativa o acesso de quem saiu do nucleo. Ninguem desativa o proprio, e o de um administrador so outro
    /// administrador desativa (como em Configuracoes > Acessos).
    /// </summary>
    private async Task DeactivateAccessAsync(Guid volunteerId)
    {
        var access = await _db.Users.FirstOrDefaultAsync(u => u.VolunteerId == volunteerId);
        if (access is null || !access.IsActive) return;
        if (access.Id == _currentUser?.Id)
            throw new AppException("Você não pode desativar o próprio acesso.");
        if (access.Role == UserRole.Administrador && _currentUser?.IsAdmin != true)
            throw AppException.Forbidden("Só um administrador desativa o acesso de outro administrador.");
        access.IsActive = false;
    }

    /// <summary>
    /// O acesso usa o nome e o e-mail do cadastro: o nome acompanha sempre; o e-mail novo vira o login (so quando o
    /// e-mail muda, para nao trocar o login de quem tinha outro por uma edicao qualquer).
    /// </summary>
    private async Task SyncAccessAsync(Volunteer volunteer, string? previousEmail)
    {
        var access = await _db.Users.FirstOrDefaultAsync(u => u.VolunteerId == volunteer.Id);
        if (access is null) return;

        access.Name = volunteer.Name;
        if (volunteer.Email == previousEmail) return;

        if (string.IsNullOrEmpty(volunteer.Email))
            throw new AppException("Este voluntário tem acesso à plataforma: o e-mail é o login e não pode ficar em branco.");
        // O e-mail e o login em toda a plataforma: nao pode repetir nem em outro nucleo.
        if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Id != access.Id && u.Email.ToLower() == volunteer.Email))
            throw AppException.Conflict("Já existe um acesso com este e-mail.");
        access.Email = volunteer.Email;
    }

    /// <summary>
    /// LGPD: troca a exclusao. Apaga nome, contatos, habilidades, observacoes, aniversario e foto, desvincula o
    /// acesso e apaga os avisos da pessoa; mantem projetos, atividades e os documentos assinados (guardados para
    /// defesa da organizacao), agora sem identificar a pessoa.
    /// </summary>
    public async Task<VolunteerDto> AnonymizeAsync(Guid id)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");
        if (volunteer.AnonymizedAt.HasValue) throw new AppException("Os dados deste voluntário já foram anonimizados.");

        var photo = volunteer.PhotoStoredName;
        volunteer.Name = "Voluntário removido";
        volunteer.Email = null;
        volunteer.Phone = null;
        volunteer.Skills = null;
        volunteer.Notes = null;
        volunteer.BirthDay = null;
        volunteer.BirthMonth = null;
        volunteer.PhotoStoredName = null;
        volunteer.AnonymizedAt = DateTime.UtcNow;
        if (volunteer.Status != VolunteerStatus.ExMembro)
            await VolunteerStatusHistoryService.ApplyPeriodAsync(_db, volunteer, VolunteerStatus.ExMembro, Mapping.Today, null);

        foreach (var user in await _db.Users.Where(u => u.VolunteerId == id).ToListAsync())
            user.VolunteerId = null;

        await _db.SaveChangesAsync();
        await _db.Notifications.Where(n => n.VolunteerId == id).ExecuteDeleteAsync();
        await _storage.DeleteAsync(photo);

        return await GetAsync(id);
    }

    public async Task DeleteAsync(Guid id)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");

        // Os documentos assinados saem junto (cascata); os arquivos deles sao apagados depois.
        var documentFiles = await SignedDocumentService.StoredNamesAsync(_db, id, null);

        _db.Volunteers.Remove(volunteer);
        await _db.SaveChangesAsync();

        if (volunteer.PhotoStoredName is not null) await _storage.DeleteAsync(volunteer.PhotoStoredName);
        await _storage.DeleteManyAsync(documentFiles);
    }

    /// <summary>Troca a foto do voluntario (a imagem ja chega recortada pelo navegador).</summary>
    public async Task<VolunteerDto> SetPhotoAsync(Guid id, IFormFile file)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");
        EnsureNotAnonymized(volunteer);

        if (file is null || !PhotoExtensions.Contains(Path.GetExtension(file.FileName))
            || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new AppException("Envie uma imagem JPG, PNG ou WEBP.");

        var saved = await _storage.SaveAsync(file);
        var previous = volunteer.PhotoStoredName;

        volunteer.PhotoStoredName = saved.StoredName;
        await _db.SaveChangesAsync();

        if (previous is not null) await _storage.DeleteAsync(previous);
        return await GetAsync(id);
    }

    public async Task<VolunteerDto> RemovePhotoAsync(Guid id)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == id) ?? throw AppException.NotFound("Voluntário");

        var previous = volunteer.PhotoStoredName;
        volunteer.PhotoStoredName = null;
        await _db.SaveChangesAsync();

        if (previous is not null) await _storage.DeleteAsync(previous);
        return await GetAsync(id);
    }

    public async Task<List<ProjectVolunteerDto>> ListByProjectAsync(Guid projectId)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var links = await _db.ProjectVolunteers
            .AsNoTracking()
            .Include(pv => pv.Volunteer)
            .Where(pv => pv.ProjectId == projectId)
            .OrderBy(pv => pv.Volunteer!.Name)
            .ToListAsync();

        return links.Select(Mapping.ToDto).ToList();
    }

    public async Task<ProjectVolunteerDto> AddToProjectAsync(Guid projectId, AddProjectVolunteerRequest request)
    {
        if (!await _db.Projects.AnyAsync(p => p.Id == projectId))
            throw AppException.NotFound("Projeto");

        var volunteerId = request.VolunteerId!.Value;
        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId))
            throw AppException.NotFound("Voluntário");

        if (await _db.ProjectVolunteers.AnyAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId))
            throw AppException.Conflict("Este voluntário já participa do projeto.");

        var link = new ProjectVolunteer
        {
            ProjectId = projectId,
            VolunteerId = volunteerId,
            RoleInProject = string.IsNullOrWhiteSpace(request.RoleInProject) ? null : request.RoleInProject.Trim(),
            JoinedAt = DateTime.UtcNow
        };

        _db.ProjectVolunteers.Add(link);
        await _notifications.AddedToTeamAsync(volunteerId, projectId);
        await _db.SaveChangesAsync();

        await _db.Entry(link).Reference(l => l.Volunteer).LoadAsync();
        return Mapping.ToDto(link);
    }

    public async Task RemoveFromProjectAsync(Guid projectId, Guid volunteerId)
    {
        var link = await _db.ProjectVolunteers
            .FirstOrDefaultAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId)
            ?? throw AppException.NotFound("Vínculo do voluntário");

        if (await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerVolunteerId == volunteerId))
            throw new AppException("Este voluntário é o responsável pelo projeto. Troque o responsável antes de desvinculá-lo.");

        _db.ProjectVolunteers.Remove(link);
        await _db.SaveChangesAsync();
    }

    private static void Apply(Volunteer volunteer, SaveVolunteerRequest r)
    {
        volunteer.Name = r.Name.Trim();
        volunteer.Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
        volunteer.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone.Trim();
        volunteer.Sector = r.Sector!.Value;
        volunteer.Skills = string.IsNullOrWhiteSpace(r.Skills) ? null : r.Skills.Trim();
        volunteer.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        volunteer.Status = r.Status!.Value;
        volunteer.BirthDay = r.BirthDay;
        volunteer.BirthMonth = r.BirthMonth;
    }

    /// <summary>Aniversario: dia e mes juntos (ou nenhum), formando uma data que existe (29/02 vale).</summary>
    private static void ValidateBirthday(SaveVolunteerRequest r)
    {
        if (r.BirthDay.HasValue != r.BirthMonth.HasValue)
            throw new AppException("Informe o dia e o mês do aniversário.");

        if (r.BirthDay.HasValue && r.BirthDay.Value > DateTime.DaysInMonth(2000, r.BirthMonth!.Value))
            throw new AppException("Esse dia não existe no mês escolhido.");
    }
}
