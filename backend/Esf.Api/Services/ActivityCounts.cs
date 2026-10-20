using Esf.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>Resumo do que fica dentro de uma atividade, para os cards do quadro e a lista do projeto.</summary>
public record ActivityCounts(int ChecklistTotal, int ChecklistDone, int Attachments)
{
    /// <summary>Contagens de varias atividades de uma vez (consultas agrupadas).</summary>
    public static async Task<Dictionary<Guid, ActivityCounts>> ForAsync(EsfDbContext db, IReadOnlyCollection<Guid> ids)
    {
        if (ids.Count == 0) return new Dictionary<Guid, ActivityCounts>();

        var checklist = await db.ActivityChecklistItems
            .Where(i => ids.Contains(i.ActivityId))
            .GroupBy(i => i.ActivityId)
            .Select(g => new { g.Key, Total = g.Count(), Done = g.Count(i => i.Done) })
            .ToDictionaryAsync(x => x.Key, x => (x.Total, x.Done));

        var attachments = await db.ProjectFiles
            .Where(f => f.ActivityId != null && ids.Contains(f.ActivityId.Value))
            .GroupBy(f => f.ActivityId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        return ids.Distinct().ToDictionary(id => id, id =>
        {
            var (total, done) = checklist.GetValueOrDefault(id);
            return new ActivityCounts(total, done, attachments.GetValueOrDefault(id));
        });
    }
}
