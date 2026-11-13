using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Sugere quem vai a uma visita e em que turno: pela grade de disponibilidade de cada voluntario ativo, pela
/// tempo estimado de casa ate a obra (VisitTravel: distancia e meio de transporte) e pela carga de tarefas. Regra
/// simples e visivel na tela (sem pontuacao escondida): primeiro quem esta livre no turno, depois quem nao preencheu a
/// grade, por ultimo quem marcou o turno como ocupado ou ja tem outra visita nele; dentro de cada grupo, quem chega
/// mais rapido e, no empate, o menos carregado.
/// </summary>
public class VisitPlannerService
{
    /// <summary>Quantos dias a frente os turnos sugeridos olham (a partir de amanha).</summary>
    public const int SlotDays = 14;
    public const int MaxSlots = 6;
    /// <summary>Uma visita sempre tem duas pessoas: as duas primeiras que podem ir ficam marcadas.</summary>
    public const int SuggestedPeople = 2;

    private readonly EsfDbContext _db;

    public VisitPlannerService(EsfDbContext db) => _db = db;

    public async Task<VisitSuggestionsDto> SuggestAsync(Guid projectId, DateOnly? date, Shift? shift, Guid? activityId)
    {
        var project = await _db.Projects.AsNoTracking()
                          .Where(p => p.Id == projectId)
                          .Select(p => new { p.Latitude, p.Longitude })
                          .FirstOrDefaultAsync()
                      ?? throw AppException.NotFound("Projeto");

        var people = await _db.Volunteers.AsNoTracking()
            .Where(v => v.Status == VolunteerStatus.Ativo && v.AnonymizedAt == null)
            .Select(v => new
            {
                v.Id, v.Name, v.PhotoStoredName, v.HomeDistrict, v.HomeLatitude, v.HomeLongitude, v.Transport,
                v.AvailabilityMask, v.AvailabilityUpdatedAt
            })
            .ToListAsync();

        var slots = new List<VisitSlotDto>();
        var today = Mapping.Today;
        for (var offset = 1; offset <= SlotDays; offset++)
        {
            var day = today.AddDays(offset);
            var weekDay = VolunteerAvailability.DayOf(day);
            foreach (var turn in Enum.GetValues<Shift>())
            {
                var free = people.Where(p => VolunteerAvailability.Has(p.AvailabilityMask, weekDay, turn)).ToList();
                if (free.Count >= SuggestedPeople)
                    slots.Add(new VisitSlotDto(day, turn, free.Count, free.Count(p => p.Transport == TransportMode.Carro)));
            }
        }
        slots = slots
            .OrderByDescending(s => s.Available)
            .ThenByDescending(s => s.WithCar)
            .ThenBy(s => s.Date)
            .ThenBy(s => s.Shift)
            .Take(MaxSlots)
            .ToList();

        var located = project.Latitude.HasValue && project.Longitude.HasValue;
        var withoutAvailability = people.Count(p => p.AvailabilityUpdatedAt is null);
        if (!date.HasValue || !shift.HasValue)
            return new VisitSuggestionsDto(located, withoutAvailability, slots, new List<VisitCandidateDto>());

        // Carga: tarefas em aberto dos projetos em planejamento ou andamento (o mesmo recorte do Inicio).
        var open = await _db.Activities.AsNoTracking()
            .Where(a => a.Status != ActivityStatus.Concluida
                        && !a.Project!.IsArchived
                        && (a.Project.Status == ProjectStatus.Planejamento || a.Project.Status == ProjectStatus.EmAndamento))
            .Select(a => new { a.AssignedVolunteerId, a.CompanionVolunteerId })
            .ToListAsync();
        var load = open
            .SelectMany(a => new[] { a.AssignedVolunteerId, a.CompanionVolunteerId }.Where(id => id.HasValue).Distinct())
            .GroupBy(id => id!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        // Quem ja tem outra visita (em aberto) no mesmo dia e turno.
        var sameShift = await _db.Activities.AsNoTracking()
            .Where(a => a.Kind == ActivityKind.Visita && a.DueDate == date && a.VisitShift == shift
                        && a.Status != ActivityStatus.Concluida && a.Id != activityId)
            .Select(a => new { a.AssignedVolunteerId, a.CompanionVolunteerId })
            .ToListAsync();
        var otherVisit = sameShift
            .SelectMany(a => new[] { a.AssignedVolunteerId, a.CompanionVolunteerId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToHashSet();

        var weekDayOfVisit = VolunteerAvailability.DayOf(date.Value);
        var ranked = people
            .Select(p =>
            {
                var availability = p.AvailabilityUpdatedAt is null
                    ? VisitAvailability.NaoInformou
                    : VolunteerAvailability.Has(p.AvailabilityMask, weekDayOfVisit, shift.Value)
                        ? VisitAvailability.Livre
                        : VisitAvailability.Ocupado;
                double? distance = located && p.HomeLatitude.HasValue && p.HomeLongitude.HasValue
                    ? Math.Round(VolunteerAvailability.DistanceKm(p.HomeLatitude.Value, p.HomeLongitude.Value,
                        project.Latitude!.Value, project.Longitude!.Value), 1)
                    : null;
                (int Minutes, TravelMode Mode)? travel = distance.HasValue
                    ? VisitTravel.Estimate(distance.Value, p.Transport)
                    : null;
                var busy = otherVisit.Contains(p.Id);
                // Grupo: livre (0), nao informou (1), ocupado (2), outra visita no turno (3).
                var group = busy ? 3 : (int)availability;
                return new { p, availability, distance, travel, busy, group, load = load.GetValueOrDefault(p.Id) };
            })
            .OrderBy(x => x.group)
            .ThenBy(x => x.travel?.Minutes ?? int.MaxValue)
            .ThenBy(x => x.load)
            .ThenBy(x => x.p.Name)
            .ToList();

        // As duas primeiras que podem ir (livres ou sem a grade preenchida) ficam marcadas como sugestao.
        var suggested = ranked.Where(x => x.group <= 1).Take(SuggestedPeople).Select(x => x.p.Id).ToHashSet();
        var candidates = ranked
            .Select(x => new VisitCandidateDto(
                x.p.Id,
                x.p.Name,
                Mapping.PhotoUrl(x.p.PhotoStoredName),
                x.p.HomeDistrict,
                x.availability,
                x.busy,
                x.distance,
                x.p.Transport,
                x.load,
                suggested.Contains(x.p.Id),
                x.travel?.Minutes,
                x.travel?.Mode,
                x.travel.HasValue && x.p.Transport is null))
            .ToList();

        return new VisitSuggestionsDto(located, withoutAvailability, slots, candidates);
    }
}
