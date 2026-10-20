using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Historico de status do voluntario e as horas de voluntariado que saem dele. O historico e uma lista de
/// mudancas ("a partir de tal dia, Afastado"); cada status vale ate a mudanca seguinte e o ultimo e o atual.
/// </summary>
public class VolunteerStatusHistoryService
{
    /// <summary>Carga semanal usada nas horas de voluntariado (a mesma sugerida no certificado).</summary>
    public const int WeeklyHours = 6;

    private static readonly DateOnly MinDate = new(1990, 1, 1);

    private readonly EsfDbContext _db;
    private readonly ICurrentUser _currentUser;

    public VolunteerStatusHistoryService(EsfDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>Uma mudanca do historico. Status vazio: sem registro a partir desse dia.</summary>
    private record struct Point(DateOnly On, VolunteerStatus? Status);

    public async Task<VolunteerHoursDto> GetAsync(Guid volunteerId)
    {
        if (!await _db.Volunteers.AnyAsync(v => v.Id == volunteerId))
            throw AppException.NotFound("Voluntario");

        var changes = await _db.VolunteerStatusChanges.AsNoTracking()
            .Where(c => c.VolunteerId == volunteerId)
            .OrderBy(c => c.StartsOn)
            .ToListAsync();

        var periods = Periods(changes);
        var history = await CanSeeHistoryAsync(volunteerId)
            ? periods.OrderByDescending(p => p.StartsOn).ToList()
            : null;
        return new VolunteerHoursDto(Hours(periods), WeeklyHours, history);
    }

    /// <summary>Coordenacao e administracao veem o historico de todos; os demais, so o proprio.</summary>
    private async Task<bool> CanSeeHistoryAsync(Guid volunteerId)
    {
        if (_currentUser.Role is UserRole.Administrador or UserRole.Coordenador) return true;
        var userId = _currentUser.Id;
        return userId.HasValue && await _db.Users.AnyAsync(u => u.Id == userId && u.VolunteerId == volunteerId);
    }

    /// <summary>Inclui um periodo: substitui o que havia nessas datas e, depois dele, volta o status anterior.</summary>
    public async Task<VolunteerHoursDto> AddPeriodAsync(Guid volunteerId, SaveStatusPeriodRequest request)
    {
        var (from, to) = ValidateDates(request);
        var volunteer = await LoadEditableAsync(volunteerId);
        await ApplyPeriodAsync(_db, volunteer, request.Status!.Value, from, to);
        await _db.SaveChangesAsync();
        return await GetAsync(volunteerId);
    }

    /// <summary>Edita um periodo: e como tirar o periodo antigo e incluir o novo.</summary>
    public async Task<VolunteerHoursDto> UpdatePeriodAsync(Guid volunteerId, Guid periodId, SaveStatusPeriodRequest request)
    {
        var (from, to) = ValidateDates(request);
        var volunteer = await LoadEditableAsync(volunteerId);
        var changes = await LoadChangesAsync(_db, volunteerId);
        var period = changes.FirstOrDefault(c => c.Id == periodId && c.Status.HasValue)
                     ?? throw AppException.NotFound("Periodo");

        var points = Without(ToPoints(changes), period.StartsOn);
        Save(_db, volunteer, changes, WithPeriod(points, request.Status!.Value, from, to));
        await _db.SaveChangesAsync();
        return await GetAsync(volunteerId);
    }

    /// <summary>Tira um periodo: o status anterior a ele passa a valer tambem nessas datas.</summary>
    public async Task<VolunteerHoursDto> DeletePeriodAsync(Guid volunteerId, Guid periodId)
    {
        var volunteer = await LoadEditableAsync(volunteerId);
        var changes = await LoadChangesAsync(_db, volunteerId);
        var period = changes.FirstOrDefault(c => c.Id == periodId && c.Status.HasValue)
                     ?? throw AppException.NotFound("Periodo");

        var points = Without(ToPoints(changes), period.StartsOn);
        if (points.Count == 0 || points[^1].Status is null)
            throw new AppException(
                "Nao da para tirar esse periodo: o historico ficaria sem o status atual. Edite o periodo para corrigir.");

        Save(_db, volunteer, changes, points);
        await _db.SaveChangesAsync();
        return await GetAsync(volunteerId);
    }

    /// <summary>
    /// Registra "status de from ate to (ou ate hoje)" e acerta o status atual do voluntario. Usado tambem quando a
    /// situacao muda pelo cadastro (a partir de hoje). Nao salva.
    /// </summary>
    public static async Task ApplyPeriodAsync(EsfDbContext db, Volunteer volunteer, VolunteerStatus status,
        DateOnly from, DateOnly? to)
    {
        var changes = await LoadChangesAsync(db, volunteer.Id);
        Save(db, volunteer, changes, WithPeriod(ToPoints(changes), status, from, to));
    }

    /// <summary>Primeira linha do historico de um voluntario recem-cadastrado. Nao salva.</summary>
    public static void Start(EsfDbContext db, Volunteer volunteer, DateOnly on) =>
        db.VolunteerStatusChanges.Add(new VolunteerStatusChange
        {
            VolunteerId = volunteer.Id,
            Status = volunteer.Status,
            StartsOn = on
        });

    private async Task<Volunteer> LoadEditableAsync(Guid volunteerId)
    {
        var volunteer = await _db.Volunteers.FirstOrDefaultAsync(v => v.Id == volunteerId)
                        ?? throw AppException.NotFound("Voluntario");
        if (volunteer.AnonymizedAt.HasValue)
            throw new AppException("Os dados deste voluntario foram anonimizados e nao podem mais ser editados.");
        return volunteer;
    }

    private static Task<List<VolunteerStatusChange>> LoadChangesAsync(EsfDbContext db, Guid volunteerId) =>
        db.VolunteerStatusChanges.Where(c => c.VolunteerId == volunteerId).OrderBy(c => c.StartsOn).ToListAsync();

    private static (DateOnly From, DateOnly? To) ValidateDates(SaveStatusPeriodRequest request)
    {
        var from = request.StartsOn!.Value;
        var to = request.EndsOn;
        var today = Mapping.Today;

        if (from < MinDate) throw new AppException("Data de inicio invalida.");
        if (from > today) throw new AppException("A data de inicio nao pode ser no futuro.");
        if (to.HasValue && to.Value < from) throw new AppException("A data final deve ser depois da data de inicio.");
        if (to.HasValue && to.Value >= today)
            throw new AppException("A data final deve ser antes de hoje. Se o periodo continua, deixe a data final em branco.");
        return (from, to);
    }

    private static List<Point> ToPoints(IEnumerable<VolunteerStatusChange> changes) =>
        changes.OrderBy(c => c.StartsOn).Select(c => new Point(c.StartsOn, c.Status)).ToList();

    /// <summary>Status que valia num dia (null: antes do primeiro registro ou num intervalo sem registro).</summary>
    private static VolunteerStatus? StatusOn(IReadOnlyList<Point> points, DateOnly day)
    {
        VolunteerStatus? status = null;
        foreach (var point in points)
        {
            if (point.On > day) break;
            status = point.Status;
        }
        return status;
    }

    private static List<Point> WithPeriod(IReadOnlyList<Point> points, VolunteerStatus status, DateOnly from, DateOnly? to)
    {
        var result = points.Where(p => p.On < from || (to.HasValue && p.On > to.Value.AddDays(1))).ToList();
        result.Add(new Point(from, status));
        if (to.HasValue)
        {
            // No dia seguinte volta o que valia antes (ou "sem registro", se o periodo e anterior ao historico).
            var next = to.Value.AddDays(1);
            result.Add(new Point(next, StatusOn(points, next)));
        }
        return Normalize(result);
    }

    private static List<Point> Without(IEnumerable<Point> points, DateOnly on) => Normalize(points.Where(p => p.On != on));

    /// <summary>Em ordem, sem "sem registro" no inicio e sem duas mudancas seguidas para o mesmo status.</summary>
    private static List<Point> Normalize(IEnumerable<Point> points)
    {
        var result = new List<Point>();
        foreach (var point in points.OrderBy(p => p.On))
        {
            if (result.Count == 0 && point.Status is null) continue;
            if (result.Count > 0 && result[^1].Status == point.Status) continue;
            result.Add(point);
        }
        return result;
    }

    /// <summary>Grava o historico novo aproveitando as linhas que ja existem na mesma data.</summary>
    private static void Save(EsfDbContext db, Volunteer volunteer, List<VolunteerStatusChange> existing, List<Point> points)
    {
        if (points.Count == 0 || points[^1].Status is null)
            throw new AppException("O historico precisa terminar no status atual do voluntario.");

        var byDate = existing.ToDictionary(c => c.StartsOn);
        foreach (var point in points)
        {
            if (byDate.Remove(point.On, out var change))
            {
                if (change.Status != point.Status) change.Status = point.Status;
                continue;
            }
            db.VolunteerStatusChanges.Add(new VolunteerStatusChange
            {
                VolunteerId = volunteer.Id,
                Status = point.Status,
                StartsOn = point.On
            });
        }
        db.VolunteerStatusChanges.RemoveRange(byDate.Values);

        volunteer.Status = points[^1].Status!.Value;
    }

    /// <summary>Periodos com status (os intervalos sem registro ficam de fora), do mais antigo ao atual.</summary>
    private static List<VolunteerStatusPeriodDto> Periods(IReadOnlyList<VolunteerStatusChange> changes)
    {
        var periods = new List<VolunteerStatusPeriodDto>();
        for (var i = 0; i < changes.Count; i++)
        {
            if (changes[i].Status is not { } status) continue;
            DateOnly? end = i + 1 < changes.Count ? changes[i + 1].StartsOn.AddDays(-1) : null;
            periods.Add(new VolunteerStatusPeriodDto(changes[i].Id, status, changes[i].StartsOn, end));
        }
        return periods;
    }

    /// <summary>Dias como Ativo (contando o primeiro e o ultimo; o periodo atual vai ate hoje) x carga semanal.</summary>
    private static int Hours(IEnumerable<VolunteerStatusPeriodDto> periods)
    {
        var today = Mapping.Today;
        var days = periods
            .Where(p => p.Status == VolunteerStatus.Ativo && p.StartsOn <= today)
            .Sum(p => (p.EndsOn ?? today).DayNumber - p.StartsOn.DayNumber + 1);
        return (int)Math.Floor(days / 7.0 * WeeklyHours);
    }
}
