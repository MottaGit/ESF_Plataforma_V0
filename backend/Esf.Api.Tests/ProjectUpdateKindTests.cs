using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>Tipo do registro de andamento (opcional): escolhido ao registrar, trocado ou tirado ao editar.</summary>
public class ProjectUpdateKindTests
{
    [Fact]
    public async Task RecordKeepsTheChosenKindAndEditingChangesOrClearsIt()
    {
        var f = await TwoNucleos.CreateAsync();
        await using var db = f.Context(f.A.Admin);
        var updates = new ProjectUpdateService(db, new FileStorageService(db, Options.Create(new StorageOptions())), f.A.Admin);

        var created = await updates.CreateAsync(f.A.ProjectId,
            new CreateProjectUpdateRequest { Text = "<p>Concretagem do piso</p>", Kind = ProjectUpdateKind.Obra }, f.A.AdminUserId);
        Assert.Equal(ProjectUpdateKind.Obra, created.Kind);

        var plain = await updates.CreateAsync(f.A.ProjectId, new CreateProjectUpdateRequest { Text = "<p>Sem tipo</p>" }, f.A.AdminUserId);
        Assert.Null(plain.Kind);

        var changed = await updates.UpdateAsync(created.Id,
            new SaveProjectUpdateRequest { Text = created.Text, Kind = ProjectUpdateKind.VisitaTecnica });
        Assert.Equal(ProjectUpdateKind.VisitaTecnica, changed.Kind);
        Assert.Null((await updates.UpdateAsync(created.Id, new SaveProjectUpdateRequest { Text = created.Text })).Kind);

        await Assert.ThrowsAsync<AppException>(() => updates.CreateAsync(f.A.ProjectId,
            new CreateProjectUpdateRequest { Text = "<p>Tipo inventado</p>", Kind = (ProjectUpdateKind)99 }, f.A.AdminUserId));
    }

    [Theory]
    [InlineData(ProjectUpdateKind.VisitaTecnica, "Visita técnica")]
    [InlineData(ProjectUpdateKind.Obra, "Obra")]
    [InlineData(ProjectUpdateKind.AcaoComunidade, "Ação com a comunidade")]
    [InlineData(ProjectUpdateKind.EntregaFinal, "Entrega final")]
    public void EachKindHasItsName(ProjectUpdateKind kind, string label) => Assert.Equal(label, UpdateKinds.Label(kind));
}
