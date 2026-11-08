using Esf.Api.Common;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Certificado com opcoes: periodo completo (do historico), periodo escolhido e por projeto (periodo sugerido, horas
/// lancadas e o que a pessoa fez); a pessoa precisa participar do projeto.
/// </summary>
public class CertificateTests
{
    private static readonly DateOnly Today = Mapping.Today;

    private static CertificateService Service(Data.EsfDbContext db) =>
        new(db, new FileStorageService(db, Options.Create(new StorageOptions())));

    private static async Task AddHoursAsync(TwoNucleos f, Nucleo nucleo, params (int DaysAgo, decimal Hours, string What)[] entries)
    {
        await using var db = f.SystemContext();
        db.ProjectHourEntries.AddRange(entries.Select(e => new ProjectHourEntry
        {
            ProjectId = nucleo.ProjectId,
            VolunteerId = nucleo.VolunteerId,
            Date = Today.AddDays(-e.DaysAgo),
            Hours = e.Hours,
            Description = e.What
        }));
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task OptionsBringTheFullPeriodAndTheProjects()
    {
        var f = await TwoNucleos.CreateAsync();
        await AddHoursAsync(f, f.A, (8, 3, "Visita técnica"), (2, 2.5m, "Projeto hidrossanitário"), (1, 1, "visita técnica"));
        await using var db = f.Context(f.A.Admin);

        var options = await Service(db).OptionsAsync(f.A.VolunteerId);

        Assert.Equal(Today.AddDays(-30), options.Full!.Start);
        Assert.Equal(Today, options.Full.End);
        Assert.Equal(VolunteerStatusHistoryService.HoursFor(31), options.Full.Hours);
        var project = Assert.Single(options.Projects);
        Assert.Equal(f.A.ProjectId, project.ProjectId);
        Assert.Equal(6.5m, project.Hours);
        Assert.Equal(Today.AddDays(-8), project.Start); // entrou na equipe hoje, mas lancou horas antes
        Assert.Equal(Today, project.End);
        Assert.Equal("Visita técnica; projeto hidrossanitário.", project.Activities);
    }

    [Fact]
    public async Task EachKindGeneratesAPdf()
    {
        var f = await TwoNucleos.CreateAsync();
        await AddHoursAsync(f, f.A, (3, 4, "Visita técnica"));
        await using var db = f.Context(f.A.Admin);
        var service = Service(db);

        var full = await service.GenerateAsync(f.A.VolunteerId, new CertificateRequest { Kind = CertificateKind.Full });
        var period = await service.GenerateAsync(f.A.VolunteerId, new CertificateRequest
        {
            Kind = CertificateKind.Period, StartDate = Today.AddDays(-20), EndDate = Today, WeeklyHours = 4
        });
        var project = await service.GenerateAsync(f.A.VolunteerId, new CertificateRequest
        {
            Kind = CertificateKind.Project, ProjectId = f.A.ProjectId, StartDate = Today.AddDays(-10), EndDate = Today,
            ProjectSummary = "Banheiro para a família", Activities = "Visita técnica.", Cpf = "52998224725"
        });

        Assert.All(new[] { full, period, project }, pdf => Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(pdf.Content, 0, 4)));
        Assert.Equal("certificado-voluntario-a-projeto-a.pdf", project.FileName);
    }

    [Fact]
    public async Task ProjectCertificateNeedsSomeoneFromTheProject()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        var error = await Assert.ThrowsAsync<AppException>(() => Service(db).GenerateAsync(f.A.VolunteerWithoutAccessId,
            new CertificateRequest { Kind = CertificateKind.Project, ProjectId = f.A.ProjectId, StartDate = Today, EndDate = Today }));

        Assert.Contains("não participa", error.Message);
    }

    [Fact]
    public async Task FullPeriodNeedsAnActivePeriod()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        Assert.Null((await Service(db).OptionsAsync(f.A.VolunteerWithoutAccessId)).Full);
        await Assert.ThrowsAsync<AppException>(() => Service(db).GenerateAsync(f.A.VolunteerWithoutAccessId,
            new CertificateRequest { Kind = CertificateKind.Full }));
    }

    [Fact]
    public async Task PeriodMustBeValid()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);

        await Assert.ThrowsAsync<AppException>(() => Service(db).GenerateAsync(f.A.VolunteerId,
            new CertificateRequest { Kind = CertificateKind.Period, StartDate = Today, EndDate = Today.AddDays(-1) }));
        await Assert.ThrowsAsync<AppException>(() => Service(db).GenerateAsync(f.A.VolunteerId,
            new CertificateRequest { Kind = CertificateKind.Period }));
    }
}
