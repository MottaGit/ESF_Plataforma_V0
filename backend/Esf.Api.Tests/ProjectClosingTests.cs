using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>Dia em que o projeto foi concluido ou cancelado: gravado ao encerrar, apagado ao reabrir.</summary>
public class ProjectClosingTests
{
    private static ProjectService Service(Data.EsfDbContext db, TestUser user) => new(db, new NotificationService(db, user));

    [Fact]
    public async Task ClosingRecordsTheDayAndReopeningClearsIt()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var projects = Service(db, f.A.Admin);
        var today = Mapping.Today;

        // Sem dia: hoje. Com dia: o informado (o projeto comecou ha 10 dias).
        Assert.Equal(today, (await projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido)).ClosedOn);
        Assert.Equal(today.AddDays(-2),
            (await projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido, today.AddDays(-2))).ClosedOn);
        // Escolher de novo o mesmo status, sem dia, mantem o que havia.
        Assert.Equal(today.AddDays(-2), (await projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido)).ClosedOn);

        // Depois de hoje nao; conclusao antes do inicio tambem nao.
        await Assert.ThrowsAsync<AppException>(() =>
            projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido, today.AddDays(1)));
        await Assert.ThrowsAsync<AppException>(() =>
            projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Concluido, today.AddDays(-30)));

        // Reabrir apaga o dia; cancelar grava de novo.
        Assert.Null((await projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.EmAndamento)).ClosedOn);
        Assert.Equal(today, (await projects.UpdateStatusAsync(f.A.ProjectId, ProjectStatus.Cancelado)).ClosedOn);
    }

    [Fact]
    public async Task EditingAClosedProjectCanFixOrLeaveTheDayBlank()
    {
        var f = await TwoNucleos.CreateAsync();
        await using (var system = f.SystemContext())
        {
            // Encerrado antes de o campo existir: sem dia.
            var project = await system.Projects.SingleAsync(p => p.Id == f.A.ProjectId);
            project.Status = ProjectStatus.Concluido;
            await system.SaveChangesAsync();
        }

        await using var db = f.Context(f.A.Admin);
        var projects = Service(db, f.A.Admin);
        var detail = await projects.GetDetailAsync(f.A.ProjectId);
        SaveProjectRequest Request(DateOnly? closedOn) => new()
        {
            Name = detail.Name, ProgramId = detail.ProgramId, StartDate = detail.StartDate,
            Status = ProjectStatus.Concluido, ClosedOn = closedOn
        };

        // Salvar sem mexer no dia nao inventa um; informar corrige.
        Assert.Null((await projects.UpdateAsync(f.A.ProjectId, Request(null))).ClosedOn);
        var day = Mapping.Today.AddDays(-3);
        Assert.Equal(day, (await projects.UpdateAsync(f.A.ProjectId, Request(day))).ClosedOn);
        await Assert.ThrowsAsync<AppException>(() => projects.UpdateAsync(f.A.ProjectId, Request(Mapping.Today.AddDays(1))));
    }
}
