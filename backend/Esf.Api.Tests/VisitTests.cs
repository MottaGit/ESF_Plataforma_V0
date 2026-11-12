using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Visita: tarefa com dia, turno e duas pessoas (responsavel e acompanhante).</summary>
public class VisitTests
{
    private static ActivityService Activities(EsfDbContext db, TestUser user)
    {
        var notifications = new NotificationService(db, user);
        return new ActivityService(db, notifications, new ActivityCommentService(db, user, notifications));
    }

    private static VolunteerService Volunteers(EsfDbContext db, TestUser user) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())), new NotificationService(db, user), user);

    private static SaveActivityRequest Visit(Nucleo n) => new()
    {
        Title = "Visita técnica à casa",
        Kind = ActivityKind.Visita,
        Status = ActivityStatus.AFazer,
        Priority = ActivityPriority.Media,
        DueDate = Mapping.Today.AddDays(3),
        VisitShift = Shift.Tarde,
        VisitTime = "14:30",
        AssignedVolunteerId = n.VolunteerId,
        CompanionVolunteerId = n.VolunteerWithoutAccessId
    };

    [Fact]
    public async Task VisitNeedsTheDayTheShiftAndTwoDifferentPeople()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var activities = Activities(db, f.A.Admin);

        var alone = Visit(f.A);
        alone.CompanionVolunteerId = null;
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.A.ProjectId, alone));

        var twice = Visit(f.A);
        twice.CompanionVolunteerId = f.A.VolunteerId;
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.A.ProjectId, twice));

        var noShift = Visit(f.A);
        noShift.VisitShift = null;
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.A.ProjectId, noShift));

        var noDay = Visit(f.A);
        noDay.DueDate = null;
        await Assert.ThrowsAsync<AppException>(() => activities.CreateAsync(f.A.ProjectId, noDay));

        var created = await activities.CreateAsync(f.A.ProjectId, Visit(f.A));
        Assert.Equal(ActivityKind.Visita, created.Kind);
        Assert.Equal(Shift.Tarde, created.VisitShift);
        Assert.Equal("14:30", created.VisitTime);
        Assert.Equal(f.A.VolunteerWithoutAccessId, created.CompanionVolunteerId);
        Assert.NotNull(created.CompanionVolunteerName);

        // O acompanhante entra na equipe e recebe o aviso (o responsavel e quem criou: nao avisa a si mesmo).
        Assert.True(await db.ProjectVolunteers.AnyAsync(pv =>
            pv.ProjectId == f.A.ProjectId && pv.VolunteerId == f.A.VolunteerWithoutAccessId));
        var notice = await db.Notifications.SingleAsync(n =>
            n.VolunteerId == f.A.VolunteerWithoutAccessId && n.ActivityId == created.Id);
        Assert.Contains("visita", notice.Message);
        Assert.Contains("à tarde", notice.Message);
    }

    [Fact]
    public async Task CompanionHasTheVisitAmongTheirTasksAndItCountsAsLoad()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var created = await Activities(db, f.A.Admin).CreateAsync(f.A.ProjectId, Visit(f.A));

        var upcoming = await Activities(db, f.A.Admin).ListUpcomingAsync(20, f.A.VolunteerWithoutAccessId);
        Assert.Contains(upcoming, a => a.Id == created.Id);

        var load = await Volunteers(db, f.A.Admin).LoadAsync();
        Assert.Equal(1, load.Single(l => l.VolunteerId == f.A.VolunteerWithoutAccessId).OpenActivities);
        // O responsavel tem a tarefa do nucleo e a visita, sem contar a visita duas vezes.
        Assert.Equal(2, load.Single(l => l.VolunteerId == f.A.VolunteerId).OpenActivities);
    }

    [Fact]
    public async Task TurningTheVisitIntoATaskDropsShiftTimeAndCompanion()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var activities = Activities(db, f.A.Admin);
        var created = await activities.CreateAsync(f.A.ProjectId, Visit(f.A));

        var task = Visit(f.A);
        task.Kind = ActivityKind.Tarefa;
        task.DueDate = null;
        var updated = await activities.UpdateAsync(created.Id, task);

        Assert.Equal(ActivityKind.Tarefa, updated.Kind);
        Assert.Null(updated.VisitShift);
        Assert.Null(updated.VisitTime);
        Assert.Null(updated.CompanionVolunteerId);
    }

    [Fact]
    public async Task LeavingTheNucleoReleasesTheVisitToo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var created = await Activities(db, f.A.Admin).CreateAsync(f.A.ProjectId, Visit(f.A));

        var volunteers = Volunteers(db, f.A.Admin);
        var current = await volunteers.GetAsync(f.A.VolunteerWithoutAccessId);
        await volunteers.UpdateAsync(current.Id, new SaveVolunteerRequest
        {
            Name = current.Name,
            Email = current.Email,
            Sector = current.Sector,
            Status = VolunteerStatus.ExMembro,
            ReleaseTasks = true
        });

        var visit = await db.Activities.AsNoTracking().SingleAsync(a => a.Id == created.Id);
        Assert.Null(visit.CompanionVolunteerId);
        Assert.Equal(f.A.VolunteerId, visit.AssignedVolunteerId);
    }
}
