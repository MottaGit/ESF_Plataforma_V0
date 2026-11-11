using Esf.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace Esf.Api.Tests;

/// <summary>
/// Banco de cada teste. Sem configuracao, banco em memoria (rapido, roda em qualquer maquina). Com a variavel
/// ESF_TEST_POSTGRES (conexao com um servidor PostgreSQL, como no CI do GitHub), cada teste ganha um banco novo de
/// verdade, copiado de um modelo criado uma vez com todas as migracoes. Assim os mesmos testes passam tambem pelas
/// migracoes, pelas funcoes do banco (esf_fold), pelas restricoes (chave estrangeira, unico, tamanho) e pela
/// traducao das consultas para SQL, que o banco em memoria nao confere.
/// </summary>
public static class TestDatabase
{
    public const string EnvironmentVariable = "ESF_TEST_POSTGRES";

    private const string TemplateName = "esf_test_template";

    // CREATE DATABASE ... TEMPLATE recusa quando outro comando usa o modelo ao mesmo tempo: um de cada vez.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    // Criado uma vez so; se uma migracao falhar, todos os testes no PostgreSQL mostram o mesmo erro.
    private static Task? _template;

    /// <summary>Conexao com o servidor PostgreSQL de teste (sem o nome do banco), ou null para usar o banco em memoria.</summary>
    public static string? PostgresServer =>
        Environment.GetEnvironmentVariable(EnvironmentVariable) is { Length: > 0 } value ? value : null;

    public static bool UsesPostgres => PostgresServer is not null;

    /// <summary>Opcoes de um banco novo e vazio (com as migracoes, no PostgreSQL).</summary>
    public static async Task<DbContextOptions<EsfDbContext>> CreateAsync()
    {
        if (PostgresServer is not { } server)
            return new DbContextOptionsBuilder<EsfDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

        var name = $"esf_test_{Guid.NewGuid():N}";
        await Gate.WaitAsync();
        try
        {
            _template ??= CreateTemplateAsync(server);
            await _template;
            await ExecuteAsync(server, $"CREATE DATABASE \"{name}\" TEMPLATE \"{TemplateName}\"");
        }
        finally
        {
            Gate.Release();
        }

        return Options(server, name);
    }

    private static async Task CreateTemplateAsync(string server)
    {
        await ExecuteAsync(server, $"DROP DATABASE IF EXISTS \"{TemplateName}\" WITH (FORCE)");
        await ExecuteAsync(server, $"CREATE DATABASE \"{TemplateName}\"");

        // O mesmo caminho do deploy: Program.cs aplica as migracoes com MigrateAsync ao iniciar.
        await using var db = new EsfDbContext(Options(server, TemplateName));
        await db.Database.MigrateAsync();
    }

    // Consulta que carrega duas colecoes ou mais num SQL so (produto cartesiano: uma linha por combinacao) falha o
    // teste: use AsSplitQuery. O banco em memoria nao avisa, por isso a regra so vale aqui.
    private static DbContextOptions<EsfDbContext> Options(string server, string database) =>
        new DbContextOptionsBuilder<EsfDbContext>()
            .UseNpgsql(Connection(server, database))
            .ConfigureWarnings(warnings => warnings.Throw(RelationalEventId.MultipleCollectionIncludeWarning))
            .Options;

    // Sem pool: cada teste tem o proprio banco, e conexoes paradas de centenas de bancos esgotariam o servidor
    // (e uma conexao aberta no modelo impediria as copias).
    private static string Connection(string server, string? database) =>
        new NpgsqlConnectionStringBuilder(server) { Database = database ?? "postgres", Pooling = false }.ConnectionString;

    private static async Task ExecuteAsync(string server, string sql)
    {
        await using var connection = new NpgsqlConnection(Connection(server, null));
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}

/// <summary>Teste que so faz sentido no PostgreSQL (funcoes do banco, SQL de verdade): pulado no banco em memoria.</summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (!TestDatabase.UsesPostgres)
            Skip = $"So roda com PostgreSQL (variavel {TestDatabase.EnvironmentVariable}).";
    }
}
