using System.Text.Json;
using Esf.Api.Common;

namespace Esf.Api.Tests;

/// <summary>
/// A chave que assina o login: sem uma propria (vazia, curta ou a de exemplo do repositorio) a API nao sobe fora do
/// desenvolvimento, senao qualquer pessoa que le o codigo criaria um token de administrador.
/// </summary>
public class JwtKeyTests
{
    [Fact]
    public void OutsideDevelopmentOnlyAnOwnKeyIsAccepted()
    {
        Assert.NotNull(JwtOptions.KeyProblem(null, isDevelopment: false));
        Assert.NotNull(JwtOptions.KeyProblem("", isDevelopment: false));
        Assert.NotNull(JwtOptions.KeyProblem(new string('k', 31), isDevelopment: false));
        // A chave de exemplo que ficou no appsettings.json ate esta versao.
        Assert.NotNull(JwtOptions.KeyProblem("troque-esta-chave-em-producao-com-no-minimo-32-caracteres", isDevelopment: false));
        Assert.Null(JwtOptions.KeyProblem("uma-chave-propria-bem-longa-com-mais-de-32-caracteres", isDevelopment: false));
    }

    [Fact]
    public void TheRepositoryKeysOnlyServeDevelopment()
    {
        // appsettings.json (vale em producao) sem chave: quem hospeda precisa definir Jwt__Key.
        Assert.NotNull(JwtOptions.KeyProblem(Key("appsettings.json"), isDevelopment: false));

        // A de appsettings.Development.json funciona no computador, mas nao num servidor.
        var development = Key("appsettings.Development.json");
        Assert.Null(JwtOptions.KeyProblem(development, isDevelopment: true));
        Assert.NotNull(JwtOptions.KeyProblem(development, isDevelopment: false));
    }

    private static string? Key(string file)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Esf.Api", file)))
            dir = dir.Parent;
        Assert.NotNull(dir);

        using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(dir!.FullName, "Esf.Api", file)),
            new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });
        return json.RootElement.GetProperty("Jwt").GetProperty("Key").GetString();
    }
}
