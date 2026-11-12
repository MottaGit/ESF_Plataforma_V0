using Esf.Api.Domain;

namespace Esf.Api.Dtos;

/// <summary>Um turno dos proximos dias com quantas pessoas costumam estar livres (e quantas vao de carro).</summary>
public record VisitSlotDto(DateOnly Date, Shift Shift, int Available, int WithCar);

/// <summary>
/// Uma pessoa para a visita, na ordem sugerida: livre no turno, sem outra visita nele, mais perto da obra e com menos
/// tarefas em aberto. DistanceKm: em linha reta, do centro do bairro dela ao ponto do projeto (null sem um dos dois).
/// Suggested: as duas primeiras que podem ir.
/// </summary>
public record VisitCandidateDto(
    Guid VolunteerId,
    string Name,
    string? PhotoUrl,
    string? District,
    VisitAvailability Availability,
    bool OtherVisit,
    double? DistanceKm,
    TransportMode? Transport,
    int OpenActivities,
    bool Suggested);

/// <summary>
/// Sugestoes para uma visita: os turnos com mais gente livre nas proximas duas semanas e, com dia e turno escolhidos,
/// todos os voluntarios ativos na ordem sugerida. WithoutAvailability: quantos ainda nao preencheram a grade.
/// </summary>
public record VisitSuggestionsDto(
    bool ProjectLocated,
    int WithoutAvailability,
    List<VisitSlotDto> Slots,
    List<VisitCandidateDto> Candidates);
