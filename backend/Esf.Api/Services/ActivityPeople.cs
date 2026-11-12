using Esf.Api.Domain;
using Esf.Api.Domain.Entities;

namespace Esf.Api.Services;

/// <summary>
/// Quem esta numa tarefa: o responsavel e, na visita, o acompanhante. Os dois contam igual em "Minhas tarefas", na
/// carga da pessoa, nos avisos e na saida do nucleo.
/// </summary>
public static class ActivityPeople
{
    /// <summary>Tarefas em que a pessoa e responsavel ou acompanhante.</summary>
    public static IQueryable<Activity> Involving(this IQueryable<Activity> activities, Guid volunteerId) =>
        activities.Where(a => a.AssignedVolunteerId == volunteerId || a.CompanionVolunteerId == volunteerId);

    public static bool Involves(this Activity activity, Guid volunteerId) =>
        activity.AssignedVolunteerId == volunteerId || activity.CompanionVolunteerId == volunteerId;

    /// <summary>O responsavel e o acompanhante, sem repetir e sem vazios.</summary>
    public static List<Guid> Of(Activity activity)
    {
        var people = new List<Guid>();
        if (activity.AssignedVolunteerId is { } assigned) people.Add(assigned);
        if (activity.CompanionVolunteerId is { } companion && !people.Contains(companion)) people.Add(companion);
        return people;
    }

    /// <summary>"qui, 20/11 a tarde, 14:30": dia e turno da visita, para os avisos.</summary>
    public static string VisitWhen(Activity activity)
    {
        if (activity.DueDate is not { } day) return "sem dia";
        var weekDay = VolunteerAvailability.DayOf(day) switch
        {
            WeekDay.Segunda => "seg",
            WeekDay.Terca => "ter",
            WeekDay.Quarta => "qua",
            WeekDay.Quinta => "qui",
            WeekDay.Sexta => "sex",
            WeekDay.Sabado => "sáb",
            _ => "dom"
        };
        var shift = activity.VisitShift switch
        {
            Shift.Manha => " de manhã",
            Shift.Tarde => " à tarde",
            Shift.Noite => " à noite",
            _ => ""
        };
        var time = string.IsNullOrEmpty(activity.VisitTime) ? "" : $", {activity.VisitTime}";
        return $"{weekDay}, {day:dd/MM}{shift}{time}";
    }
}
