using Esf.Api.Common;
using Esf.Api.Controllers;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Esf.Api.Tests;

/// <summary>
/// O contrato da API (OpenAPI) guardado em frontend/openapi.json, de onde saem os tipos do frontend
/// (src/types/openapi.ts). Mudou um DTO, uma rota ou um enum sem atualizar o contrato: este teste falha.
/// Para atualizar (depois, gere os tipos):
///   cd backend &amp;&amp; ESF_UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests
///   cd frontend &amp;&amp; npm run types
/// </summary>
public class OpenApiContractTests
{
    private const string ContractFile = "frontend/openapi.json";

    [Fact]
    public void TheFrontendContractFollowsTheApi()
    {
        var current = CurrentContract();
        var path = RepositoryFile(ContractFile);

        if (Environment.GetEnvironmentVariable("ESF_UPDATE_OPENAPI") == "1")
        {
            File.WriteAllText(path, current);
            return;
        }

        var saved = File.Exists(path) ? File.ReadAllText(path).Replace("\r\n", "\n") : "";
        Assert.True(saved == current,
            $"A API mudou e {ContractFile} nao: rode 'ESF_UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests' "
            + "em backend e depois 'npm run types' em frontend (ver o resumo desta classe).");
    }

    /// <summary>O mesmo documento do /swagger, montado com as definicoes do Program.cs (sem banco nem servidor).</summary>
    private static string CurrentContract()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddEsfControllers().AddApplicationPart(typeof(ProjectsController).Assembly);
        builder.Services.AddEsfSwagger();
        using var app = builder.Build();
        return ApiContract.OpenApiJson(app.Services);
    }

    private static string RepositoryFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "frontend", "src")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, relative);
    }
}
