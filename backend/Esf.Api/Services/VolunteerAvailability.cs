using Esf.Api.Domain;
using Esf.Api.Dtos;

namespace Esf.Api.Services;

/// <summary>
/// Grade de disponibilidade do voluntario (7 dias x 3 turnos) guardada num numero so: o bit de cada turno e
/// dia * 3 + turno. Tambem a distancia entre dois pontos do mapa, para ordenar quem mora mais perto da obra.
/// </summary>
public static class VolunteerAvailability
{
    private static readonly WeekDay[] Days = Enum.GetValues<WeekDay>();
    private static readonly Shift[] Shifts = Enum.GetValues<Shift>();

    private static int Bit(WeekDay day, Shift shift) => 1 << ((int)day * Shifts.Length + (int)shift);

    public static int ToMask(IEnumerable<AvailabilitySlotDto>? slots) =>
        (slots ?? Enumerable.Empty<AvailabilitySlotDto>())
            .Where(s => Enum.IsDefined(s.Day) && Enum.IsDefined(s.Shift))
            .Aggregate(0, (mask, s) => mask | Bit(s.Day, s.Shift));

    /// <summary>Os turnos marcados, na ordem da grade (segunda de manha primeiro).</summary>
    public static List<AvailabilitySlotDto> ToSlots(int mask) =>
        Days.SelectMany(day => Shifts.Where(shift => Has(mask, day, shift)).Select(shift => new AvailabilitySlotDto(day, shift)))
            .ToList();

    public static bool Has(int mask, WeekDay day, Shift shift) => (mask & Bit(day, shift)) != 0;

    /// <summary>Dia da semana de uma data, na ordem da grade.</summary>
    public static WeekDay DayOf(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Monday => WeekDay.Segunda,
        DayOfWeek.Tuesday => WeekDay.Terca,
        DayOfWeek.Wednesday => WeekDay.Quarta,
        DayOfWeek.Thursday => WeekDay.Quinta,
        DayOfWeek.Friday => WeekDay.Sexta,
        DayOfWeek.Saturday => WeekDay.Sabado,
        _ => WeekDay.Domingo
    };

    /// <summary>Distancia em linha reta, em km (formula de haversine). Serve para ordenar perto e longe.</summary>
    public static double DistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double earthRadiusKm = 6371;
        static double Rad(double degrees) => degrees * Math.PI / 180;

        var dLat = Rad(lat2 - lat1);
        var dLng = Rad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
