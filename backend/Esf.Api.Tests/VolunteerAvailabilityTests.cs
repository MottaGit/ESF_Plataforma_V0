using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Bairro, deslocamento e turnos livres do voluntario: quem ve, quem muda e o que some ao anonimizar.</summary>
public class VolunteerAvailabilityTests
{
    private static VolunteerService Service(EsfDbContext db, TestUser user) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())), new NotificationService(db, user), user);

    /// <summary>Da acesso (perfil Usuario) ao voluntario "Sem acesso" do nucleo e devolve quem fica logado.</summary>
    internal static async Task<TestUser> MemberLoginAsync(TwoNucleos f, Nucleo nucleo)
    {
        await using var db = f.SystemContext();
        var user = new User
        {
            OrganizationId = nucleo.OrganizationId,
            Name = "Sem acesso",
            Email = $"membro.{nucleo.OrganizationId:N}@teste.org",
            Role = UserRole.Usuario,
            VolunteerId = nucleo.VolunteerWithoutAccessId
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return new TestUser { Id = user.Id, Name = user.Name, Role = UserRole.Usuario, OrganizationId = nucleo.OrganizationId };
    }

    private static SaveAvailabilityRequest Request() => new()
    {
        District = "  Restinga ",
        City = "Porto Alegre",
        Latitude = -30.152134,
        Longitude = -51.143087,
        Transport = TransportMode.TransportePublico,
        Slots = new()
        {
            new AvailabilitySlotDto(WeekDay.Sabado, Shift.Manha),
            new AvailabilitySlotDto(WeekDay.Segunda, Shift.Noite),
            new AvailabilitySlotDto(WeekDay.Segunda, Shift.Noite)
        }
    };

    [Fact]
    public async Task PersonFillsTheirOwnAndCoordinationSeesIt()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);

        await using (var db = f.Context(member))
        {
            var saved = await Service(db, member).SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, Request());
            Assert.Equal("Restinga", saved.District);
            Assert.True(saved.Located);
            // Nunca o ponto exato: arredondado para uns 100 m.
            Assert.Equal(-30.152, saved.Latitude);
            Assert.Equal(-51.143, saved.Longitude);
            Assert.Equal(TransportMode.TransportePublico, saved.Transport);
            // Na ordem da grade e sem repetir.
            Assert.Equal(
                new[] { new AvailabilitySlotDto(WeekDay.Segunda, Shift.Noite), new AvailabilitySlotDto(WeekDay.Sabado, Shift.Manha) },
                saved.Slots);
            Assert.NotNull(saved.UpdatedAt);

            // A propria pessoa ve na pagina dela.
            Assert.NotNull((await Service(db, member).GetAsync(f.A.VolunteerWithoutAccessId)).Availability);
        }

        await using (var db = f.Context(f.A.Admin))
        {
            var volunteer = await Service(db, f.A.Admin).GetAsync(f.A.VolunteerWithoutAccessId);
            Assert.Equal("Porto Alegre", volunteer.Availability?.City);
            // A lista nao leva esses dados.
            Assert.All(await Service(db, f.A.Admin).ListAsync(null, false, null), v => Assert.Null(v.Availability));
        }
    }

    [Fact]
    public async Task SamePlaceKeepsThePointAndANewOneNeedsItsOwn()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = Service(db, f.A.Admin);
        await volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, Request());

        // O navegador so procura o bairro quando ele muda: sem ponto, o mesmo bairro fica com o de antes.
        var again = Request();
        again.Latitude = null;
        again.Longitude = null;
        again.Transport = TransportMode.Carro;
        Assert.True((await volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, again)).Located);

        // Outro bairro sem ponto: nao achado.
        again.District = "Bairro que nao existe";
        Assert.False((await volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, again)).Located);
    }

    [Fact]
    public async Task OthersNeitherSeeNorChangeIt()
    {
        var f = await TwoNucleos.CreateAsync();
        var member = await MemberLoginAsync(f, f.A);
        await using var db = f.Context(member);
        var volunteers = Service(db, member);

        // O voluntario do administrador e outra pessoa: o perfil Usuario nao ve nem muda.
        Assert.Null((await volunteers.GetAsync(f.A.VolunteerId)).Availability);
        await Assert.ThrowsAsync<AppException>(() => volunteers.GetAvailabilityAsync(f.A.VolunteerId));
        await Assert.ThrowsAsync<AppException>(() => volunteers.SaveAvailabilityAsync(f.A.VolunteerId, Request()));
        Assert.Null((await db.Volunteers.AsNoTracking().SingleAsync(v => v.Id == f.A.VolunteerId)).HomeDistrict);
    }

    [Fact]
    public async Task CoordinationChangesAnyoneAndNoPlaceMeansNoPoint()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = Service(db, f.A.Admin);

        // Sem bairro nem cidade, o ponto mandado pelo navegador nao vale.
        var request = Request();
        request.District = " ";
        request.City = null;
        var saved = await volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, request);
        Assert.False(saved.Located);
        Assert.Null((await db.Volunteers.AsNoTracking().SingleAsync(v => v.Id == f.A.VolunteerWithoutAccessId)).HomeLatitude);

        // O voluntario de outro nucleo nem aparece.
        await Assert.ThrowsAsync<AppException>(() => volunteers.SaveAvailabilityAsync(f.B.VolunteerId, Request()));
    }

    /// <summary>A anonimizacao apaga os avisos com ExecuteDelete, que o banco em memoria nao roda.</summary>
    [PostgresFact]
    public async Task AnonymizingErasesWhereThePersonLivesAndTheirShifts()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = Service(db, f.A.Admin);
        await volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, Request());

        await volunteers.AnonymizeAsync(f.A.VolunteerWithoutAccessId);

        var stored = await db.Volunteers.AsNoTracking().SingleAsync(v => v.Id == f.A.VolunteerWithoutAccessId);
        Assert.Null(stored.HomeDistrict);
        Assert.Null(stored.HomeCity);
        Assert.Null(stored.HomeLatitude);
        Assert.Null(stored.Transport);
        Assert.Equal(0, stored.AvailabilityMask);
        await Assert.ThrowsAsync<AppException>(() => volunteers.SaveAvailabilityAsync(f.A.VolunteerWithoutAccessId, Request()));
    }

    [Fact]
    public void GridKeepsEachShiftOfEachDay()
    {
        var all = Enum.GetValues<WeekDay>()
            .SelectMany(d => Enum.GetValues<Shift>().Select(s => new AvailabilitySlotDto(d, s)))
            .ToList();
        var mask = VolunteerAvailability.ToMask(all);

        Assert.Equal(21, VolunteerAvailability.ToSlots(mask).Count);
        Assert.True(VolunteerAvailability.Has(mask, WeekDay.Domingo, Shift.Noite));
        Assert.Equal(WeekDay.Quinta, VolunteerAvailability.DayOf(new DateOnly(2026, 11, 12)));
        // Centro de Porto Alegre ate a Restinga: uns 20 km em linha reta.
        Assert.InRange(VolunteerAvailability.DistanceKm(-30.0346, -51.2177, -30.1500, -51.1400), 13, 16);
    }
}
