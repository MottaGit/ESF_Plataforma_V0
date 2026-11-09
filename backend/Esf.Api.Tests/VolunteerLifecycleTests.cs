using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Entrada e saida do voluntario no nucleo.</summary>
public class VolunteerLifecycleTests
{
    private static VolunteerService Service(EsfDbContext db, TestUser user) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())), new NotificationService(db, user));

    private static SaveVolunteerRequest Request(string name, VolunteerStatus status = VolunteerStatus.Ativo) => new()
    {
        Name = name,
        Email = $"{name.Replace(' ', '.').ToLowerInvariant()}@teste.org",
        Sector = VolunteerSector.Projetos,
        Status = status
    };

    [Fact]
    public async Task NewVolunteerStartsOnTheDayTheyJoinedTheNucleo()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var volunteers = Service(db, f.A.Admin);
        var joined = Mapping.Today.AddDays(-70);

        var request = Request("Pessoa Antiga");
        request.ActiveSince = joined;
        var created = await volunteers.CreateAsync(request);

        // O historico (e as horas) comeca no dia da entrada, nao no do cadastro: 71 dias como ativo = 60 horas.
        var start = await db.VolunteerStatusChanges.Where(c => c.VolunteerId == created.Id).MinAsync(c => c.StartsOn);
        Assert.Equal(joined, start);
        Assert.Equal(60, (await new VolunteerStatusHistoryService(db, f.A.Admin).GetAsync(created.Id)).Hours);

        // Sem a data, hoje; depois de hoje, nao.
        var today = await volunteers.CreateAsync(Request("Pessoa Nova"));
        Assert.Equal(Mapping.Today,
            await db.VolunteerStatusChanges.Where(c => c.VolunteerId == today.Id).MinAsync(c => c.StartsOn));
        var future = Request("Pessoa Futura");
        future.ActiveSince = Mapping.Today.AddDays(1);
        await Assert.ThrowsAsync<AppException>(() => volunteers.CreateAsync(future));
    }
}
