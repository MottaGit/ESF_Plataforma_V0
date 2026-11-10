using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace Esf.Api.Tests;

/// <summary>
/// O que o banco em memoria nao confere: se as migracoes acompanham o modelo, se criam o banco do zero e se a busca
/// sem acento (funcoes esf_fold do PostgreSQL) funciona. Os demais testes tambem rodam no PostgreSQL no CI.
/// </summary>
public class PostgresTests
{
    /// <summary>
    /// Mudou uma entidade e esqueceu de gerar a migracao (ou a migracao ficou diferente do modelo): o banco do deploy
    /// nao teria a coluna. Nao precisa de servidor: compara o modelo com o da ultima migracao.
    /// </summary>
    [Fact]
    public async Task LastMigrationMatchesTheModel()
    {
        var options = new DbContextOptionsBuilder<EsfDbContext>().UseNpgsql("Host=localhost;Database=esf_modelo").Options;
        await using var db = new EsfDbContext(options);

        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot?.Model;
        Assert.NotNull(snapshot);
        if (snapshot is IMutableModel mutable) snapshot = mutable.FinalizeModel();
        snapshot = db.GetService<IModelRuntimeInitializer>().Initialize(snapshot);

        var differences = db.GetService<IMigrationsModelDiffer>().GetDifferences(
            snapshot.GetRelationalModel(), db.GetService<IDesignTimeModel>().Model.GetRelationalModel());

        Assert.True(differences.Count == 0,
            "O modelo mudou sem migracao (rode dotnet ef migrations add): " + string.Join("; ", differences.Select(Describe)));
    }

    [PostgresFact]
    public async Task MigrationsCreateTheDatabaseFromScratch()
    {
        await using var db = new EsfDbContext(await TestDatabase.CreateAsync());

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(db.Database.GetMigrations(), await db.Database.GetAppliedMigrationsAsync());

        // Funcoes criadas pela migracao AddSearchFunctions.
        var folded = await db.Database.SqlQuery<string>(
            $"SELECT esf_fold_html({"<p>Mutirão na <b>Conceição</b></p>"}) AS \"Value\"").SingleAsync();
        Assert.Equal(" mutirao na  conceicao  ", folded);
    }

    [PostgresFact]
    public async Task SearchIgnoresAccentsAndCaseAndStaysInTheNucleo()
    {
        var fixture = await TwoNucleos.CreateAsync();
        await using (var db = fixture.SystemContext())
        {
            db.Projects.Add(new Project
            {
                OrganizationId = fixture.A.OrganizationId,
                ProgramId = fixture.A.ProgramId,
                Name = "Horta Comunitária São José",
                StartDate = Mapping.Today,
                Status = ProjectStatus.EmAndamento
            });
            db.ProjectUpdates.Add(new ProjectUpdate
            {
                ProjectId = fixture.A.ProjectId,
                Text = "<p>Mutirão de <strong>pintura</strong> na escola</p>",
                AuthorUserId = fixture.A.AdminUserId
            });
            await db.SaveChangesAsync();
        }

        await using (var db = fixture.Context(fixture.A.Admin))
        {
            var search = new SearchService(db);
            var byName = await search.SearchAsync("SAO JOSE");
            Assert.Equal("Horta Comunitária São José", Assert.Single(byName.Projects).Name);

            var byText = await search.SearchAsync("mutirao");
            Assert.Single(byText.Updates);
        }

        // O outro nucleo nao acha nada do A, nem pela busca.
        await using (var db = fixture.Context(fixture.B.Admin))
        {
            var search = new SearchService(db);
            Assert.Empty((await search.SearchAsync("são josé")).Projects);
            Assert.Empty((await search.SearchAsync("mutirão")).Updates);
        }
    }

    private static string Describe(MigrationOperation operation)
    {
        var type = operation.GetType();
        var table = type.GetProperty("Table")?.GetValue(operation);
        var name = type.GetProperty("Name")?.GetValue(operation);
        return $"{type.Name.Replace("Operation", "")} {string.Join(".", new[] { table, name }.Where(x => x is not null))}";
    }
}
