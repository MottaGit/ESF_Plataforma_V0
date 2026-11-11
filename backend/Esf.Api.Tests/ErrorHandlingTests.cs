using System.Text.Json;
using Esf.Api.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace Esf.Api.Tests;

/// <summary>Falhas que antes viravam "Erro interno do servidor" e agora dizem o que aconteceu.</summary>
public class ErrorHandlingTests
{
    [Fact]
    public async Task SimultaneousChangesAreAConflictNotAnInternalError()
    {
        var (status, message) = await RunAsync(new DbUpdateConcurrencyException("mudou"));
        Assert.Equal(StatusCodes.Status409Conflict, status);
        Assert.Contains("ao mesmo tempo", message);

        (status, message) = await RunAsync(DatabaseError(PostgresErrorCodes.UniqueViolation));
        Assert.Equal(StatusCodes.Status409Conflict, status);
        Assert.Contains("Já existe", message);

        (status, message) = await RunAsync(DatabaseError(PostgresErrorCodes.ForeignKeyViolation));
        Assert.Equal(StatusCodes.Status409Conflict, status);
        Assert.Contains("excluído", message);
    }

    [Fact]
    public async Task OversizedUploadSaysSo()
    {
        var (status, message) = await RunAsync(new BadHttpRequestException("grande", StatusCodes.Status413PayloadTooLarge));
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, status);
        Assert.Contains("grande demais", message);
    }

    [Fact]
    public async Task ClosedScreenIsNotLoggedAsAnError()
    {
        using var aborted = new CancellationTokenSource();
        await aborted.CancelAsync();
        var (status, message) = await RunAsync(new OperationCanceledException(), aborted.Token);
        Assert.Equal(ErrorHandlingMiddleware.ClientClosedRequest, status);
        Assert.Null(message);

        // Cancelado sem a pessoa ter saido (prazo interno, por exemplo): continua sendo erro do servidor.
        (status, _) = await RunAsync(new OperationCanceledException());
        Assert.Equal(StatusCodes.Status500InternalServerError, status);
    }

    [Fact]
    public async Task OtherDatabaseErrorsStayInternal()
    {
        var (status, _) = await RunAsync(DatabaseError(PostgresErrorCodes.NotNullViolation));
        Assert.Equal(StatusCodes.Status500InternalServerError, status);
    }

    private static DbUpdateException DatabaseError(string sqlState) =>
        new("falhou", new PostgresException("falhou", "ERROR", "ERROR", sqlState));

    private static async Task<(int Status, string? Message)> RunAsync(Exception error, CancellationToken aborted = default)
    {
        var context = new DefaultHttpContext { RequestAborted = aborted };
        context.Response.Body = new MemoryStream();
        var middleware = new ErrorHandlingMiddleware(_ => throw error, NullLogger<ErrorHandlingMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var message = body.Length == 0 ? null : JsonDocument.Parse(body).RootElement.GetProperty("message").GetString();
        return (context.Response.StatusCode, message);
    }
}
