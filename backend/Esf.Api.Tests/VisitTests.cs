using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
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

    /// <summary>Proxima quinta-feira depois de hoje (a grade e por dia da semana).</summary>
    private static DateOnly NextThursday()
    {
        var day = Mapping.Today.AddDays(1);
        while (VolunteerAvailability.DayOf(day) != WeekDay.Quinta) day = day.AddDays(1);
        return day;
    }

    private static int Mask(params (WeekDay Day, Shift Shift)[] slots) =>
        VolunteerAvailability.ToMask(slots.Select(s => new AvailabilitySlotDto(s.Day, s.Shift)));

    /// <summary>
    /// Nucleo A com a obra no centro de Porto Alegre: o voluntario do administrador mora perto e esta livre na quinta a
    /// tarde, o "sem acesso" mora longe e tambem esta livre, alguem bem perto marcou a quinta a tarde como ocupada e
    /// alguem perto nunca preencheu. No nucleo B, uma pessoa livre e perto (nao pode aparecer).
    /// </summary>
    private static async Task<(Guid Busy, Guid NoGrid)> ArrangeAsync(TwoNucleos f)
    {
        await using var db = f.SystemContext();
        var freeThursday = Mask((WeekDay.Quinta, Shift.Tarde), (WeekDay.Sabado, Shift.Manha));
        var now = DateTime.UtcNow;

        var project = await db.Projects.SingleAsync(p => p.Id == f.A.ProjectId);
        project.Latitude = -30.0346;
        project.Longitude = -51.2177;

        var near = await db.Volunteers.SingleAsync(v => v.Id == f.A.VolunteerId);
        (near.HomeLatitude, near.HomeLongitude, near.Transport, near.AvailabilityMask, near.AvailabilityUpdatedAt) =
            (-30.04, -51.22, TransportMode.Carro, freeThursday, now);
        var far = await db.Volunteers.SingleAsync(v => v.Id == f.A.VolunteerWithoutAccessId);
        (far.HomeLatitude, far.HomeLongitude, far.Transport, far.AvailabilityMask, far.AvailabilityUpdatedAt) =
            (-30.15, -51.14, TransportMode.TransportePublico, freeThursday, now);

        var busy = new Volunteer
        {
            OrganizationId = f.A.OrganizationId, Name = "Ocupada", HomeLatitude = -30.035, HomeLongitude = -51.218,
            AvailabilityMask = Mask((WeekDay.Quinta, Shift.Manha)), AvailabilityUpdatedAt = now
        };
        var noGrid = new Volunteer { OrganizationId = f.A.OrganizationId, Name = "Sem grade", HomeLatitude = -30.036, HomeLongitude = -51.219 };
        var other = await db.Volunteers.SingleAsync(v => v.Id == f.B.VolunteerId);
        (other.HomeLatitude, other.HomeLongitude, other.AvailabilityMask, other.AvailabilityUpdatedAt) =
            (-30.0346, -51.2177, freeThursday, now);
        db.Volunteers.AddRange(busy, noGrid);
        await db.SaveChangesAsync();
        return (busy.Id, noGrid.Id);
    }

    [Theory]
    // Obra na Restinga: do mesmo bairro (a pe), do Menino Deus (13 km) e do Sarandi (18 km).
    [InlineData(0.6, TransportMode.TransportePublico, TravelMode.APe, 10)]
    [InlineData(13, TransportMode.Carro, TravelMode.Carro, 40)]
    [InlineData(13, TransportMode.TransportePublico, TravelMode.TransportePublico, 70)]
    [InlineData(18, TransportMode.Carro, TravelMode.Carro, 54)]
    [InlineData(18, TransportMode.TransportePublico, TravelMode.TransportePublico, 91)]
    // Sem o meio informado, conta como transporte publico.
    [InlineData(13, null, TravelMode.TransportePublico, 70)]
    public void TravelTimeIsARealisticEstimate(double straightKm, TransportMode? transport, TravelMode mode, int minutes)
    {
        var (estimated, used) = VisitTravel.Estimate(straightKm, transport);
        Assert.Equal(mode, used);
        Assert.Equal(minutes, estimated);
    }

    [Fact]
    public async Task SuggestsWhoIsFreeAndLivesNearFirst()
    {
        var f = await TwoNucleos.CreateAsync();
        var (busy, noGrid) = await ArrangeAsync(f);
        var thursday = NextThursday();
        await using var db = f.Context(f.A.Admin);

        var result = await new VisitPlannerService(db).SuggestAsync(f.A.ProjectId, thursday, Shift.Tarde, null);

        Assert.True(result.ProjectLocated);
        // Livres (perto, depois longe), quem nao preencheu, por ultimo quem marcou o turno como ocupado.
        Assert.Equal(new[] { f.A.VolunteerId, f.A.VolunteerWithoutAccessId, noGrid, busy },
            result.Candidates.Select(c => c.VolunteerId));
        Assert.Equal(new[] { true, true, false, false }, result.Candidates.Select(c => c.Suggested));
        Assert.Equal(VisitAvailability.NaoInformou, result.Candidates[2].Availability);
        Assert.Equal(VisitAvailability.Ocupado, result.Candidates[3].Availability);
        Assert.InRange(result.Candidates[0].DistanceKm!.Value, 0, 2);
        Assert.Equal(TransportMode.Carro, result.Candidates[0].Transport);
        Assert.Equal(TravelMode.Carro, result.Candidates[0].TravelMode);
        Assert.InRange(result.Candidates[0].TravelMinutes!.Value, 5, 10);
        // Quem nao preencheu (sem meio informado) conta como transporte publico.
        Assert.True(result.Candidates[2].TransportAssumed);
        // A tarefa do nucleo e do voluntario do administrador: conta como carga.
        Assert.Equal(1, result.Candidates[0].OpenActivities);
        Assert.Equal(1, result.WithoutAvailability);

        // Os turnos com mais gente livre: quinta a tarde e sabado de manha, 2 livres, 1 de carro.
        Assert.Contains(result.Slots, s => s.Date == thursday && s.Shift == Shift.Tarde && s.Available == 2 && s.WithCar == 1);
        Assert.DoesNotContain(result.Slots, s => s.Available < 2);

        // Sem dia e turno: so os turnos sugeridos.
        Assert.Empty((await new VisitPlannerService(db).SuggestAsync(f.A.ProjectId, null, null, null)).Candidates);
    }

    [Fact]
    public async Task AnotherVisitInTheSameShiftTakesThePersonOutOfTheSuggestion()
    {
        var f = await TwoNucleos.CreateAsync();
        await ArrangeAsync(f);
        var thursday = NextThursday();
        await using var db = f.Context(f.A.Admin);

        var request = Visit(f.A);
        request.DueDate = thursday;
        var visit = await Activities(db, f.A.Admin).CreateAsync(f.A.ProjectId, request);

        var planner = new VisitPlannerService(db);
        var result = await planner.SuggestAsync(f.A.ProjectId, thursday, Shift.Tarde, null);
        Assert.All(result.Candidates.Where(c => c.VolunteerId == f.A.VolunteerId || c.VolunteerId == f.A.VolunteerWithoutAccessId),
            c => Assert.True(c.OtherVisit && !c.Suggested));
        // Os dois vao para o fim (perto primeiro); a sugestao passa a ser quem nao preencheu a grade.
        Assert.Equal(new[] { f.A.VolunteerId, f.A.VolunteerWithoutAccessId },
            result.Candidates.TakeLast(2).Select(c => c.VolunteerId));
        Assert.Single(result.Candidates, c => c.Suggested);

        // Editando a propria visita, ela nao conta como "outra".
        var editing = await planner.SuggestAsync(f.A.ProjectId, thursday, Shift.Tarde, visit.Id);
        Assert.False(editing.Candidates.First().OtherVisit);
        Assert.True(editing.Candidates.First().Suggested);
    }
}
