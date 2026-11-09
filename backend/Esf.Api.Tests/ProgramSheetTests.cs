using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Esf.Api.Tests;

/// <summary>
/// Ficha do programa (o que faz, objetivo, para quem): escrita uma vez em Editar programa › Sobre, aparece na pagina
/// publica e e o ponto de partida da descricao e do objetivo de cada projeto novo.
/// </summary>
public class ProgramSheetTests
{
    private static async Task FillSheetAsync(TwoNucleos f)
    {
        await using var system = f.SystemContext();
        var program = await system.Programs.SingleAsync(p => p.Id == f.A.ProgramId);
        program.Description = "Constroi banheiros com construtor local.";
        program.Objective = "Saneamento digno.";
        program.Audience = "Famílias sem banheiro";
        await system.SaveChangesAsync();
    }

    private static async Task<ProjectDetailDto> CreateAsync(TwoNucleos f, bool useTemplate, string? description = null)
    {
        await using var db = f.Context(f.A.Admin);
        return await new ProjectService(db, new NotificationService(db, f.A.Admin)).CreateAsync(new SaveProjectRequest
        {
            Name = $"Projeto {Guid.NewGuid():N}", ProgramId = f.A.ProgramId, StartDate = Mapping.Today,
            Status = ProjectStatus.Planejamento, UseTemplate = useTemplate, Description = description
        });
    }

    [Fact]
    public async Task NewProjectStartsWithTheProgramDescriptionAndObjective()
    {
        var f = await TwoNucleos.CreateAsync();
        await FillSheetAsync(f);

        // Com ou sem o modelo (tarefas e indicadores), a ficha preenche descricao e objetivo em branco.
        foreach (var useTemplate in new[] { true, false })
        {
            var created = await CreateAsync(f, useTemplate);
            Assert.Equal(("Constroi banheiros com construtor local.", "Saneamento digno."), (created.Description, created.Objective));
            // "Quem se beneficia" e de cada projeto: o "para quem" do programa nao entra.
            Assert.Null(created.TargetAudience);
        }
    }

    [Fact]
    public async Task WhatWasTypedInTheProjectIsKept()
    {
        var f = await TwoNucleos.CreateAsync();
        await FillSheetAsync(f);

        var created = await CreateAsync(f, useTemplate: true, description: "Banheiro acessível da Sra. Julia.");

        Assert.Equal("Banheiro acessível da Sra. Julia.", created.Description);
        Assert.Equal("Saneamento digno.", created.Objective);
    }
}
