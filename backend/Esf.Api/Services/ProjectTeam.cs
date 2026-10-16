using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// A equipe do projeto (ProjectVolunteers) e a referencia de quem participa dele:
/// o responsavel pelo projeto e os responsaveis pelas atividades entram nela automaticamente.
/// </summary>
public static class ProjectTeam
{
    /// <summary>Vincula o voluntario a equipe do projeto, se ainda nao estiver. Nao chama SaveChanges.</summary>
    public static async Task EnsureMemberAsync(EsfDbContext db, Guid projectId, Guid? volunteerId)
    {
        if (!volunteerId.HasValue) return;

        var alreadyMember =
            db.ProjectVolunteers.Local.Any(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId.Value)
            || await db.ProjectVolunteers.AnyAsync(pv => pv.ProjectId == projectId && pv.VolunteerId == volunteerId.Value);

        if (alreadyMember) return;

        db.ProjectVolunteers.Add(new ProjectVolunteer
        {
            ProjectId = projectId,
            VolunteerId = volunteerId.Value,
            JoinedAt = DateTime.UtcNow
        });
    }

    /// <summary>Coloca na equipe todos os responsaveis (de projeto e de atividade) que ainda nao estao nela.</summary>
    public static async Task SyncAllAsync(EsfDbContext db)
    {
        var owners = await db.Projects
            .Where(p => p.OwnerVolunteerId != null)
            .Select(p => new { ProjectId = p.Id, VolunteerId = p.OwnerVolunteerId!.Value })
            .ToListAsync();

        var assignees = await db.Activities
            .Where(a => a.AssignedVolunteerId != null)
            .Select(a => new { a.ProjectId, VolunteerId = a.AssignedVolunteerId!.Value })
            .ToListAsync();

        var existing = (await db.ProjectVolunteers
            .Select(pv => new { pv.ProjectId, pv.VolunteerId })
            .ToListAsync()).ToHashSet();

        foreach (var pair in owners.Concat(assignees).Distinct().Where(pair => !existing.Contains(pair)))
        {
            db.ProjectVolunteers.Add(new ProjectVolunteer
            {
                ProjectId = pair.ProjectId,
                VolunteerId = pair.VolunteerId,
                JoinedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }
}
