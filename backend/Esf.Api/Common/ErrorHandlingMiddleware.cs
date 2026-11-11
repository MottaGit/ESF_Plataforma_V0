using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Esf.Api.Common;

/// <summary>Tratamento consistente de erros: sempre devolve JSON com a propriedade "message".</summary>
public class ErrorHandlingMiddleware
{
    /// <summary>A pessoa fechou a tela antes da resposta (convencao do nginx; ninguem chega a ver).</summary>
    public const int ClientClosedRequest = 499;

    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AppException ex)
        {
            await WriteAsync(context, ex.StatusCode, ex.Message);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Saiu da tela no meio: nao ha a quem responder nem erro a registrar.
            if (!context.Response.HasStarted) context.Response.StatusCode = ClientClosedRequest;
        }
        catch (BadHttpRequestException ex)
        {
            // Corpo maior que o limite da rota (envio de arquivo) ou requisicao que nao deu para ler.
            await WriteAsync(context, ex.StatusCode, ex.StatusCode == StatusCodes.Status413PayloadTooLarge
                ? "O arquivo é grande demais para enviar."
                : "A requisição veio num formato que não foi reconhecido. Tente de novo.");
        }
        catch (DbUpdateConcurrencyException)
        {
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "Outra pessoa alterou ou excluiu este registro ao mesmo tempo. Recarregue a tela e tente de novo.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Duas gravacoes iguais ao mesmo tempo (o servico confere antes, mas as duas passam pela conferencia).
            _logger.LogWarning(ex, "Registro repetido em {Path}", context.Request.Path);
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "Já existe um registro com estes dados. Recarregue a tela e confira.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation })
        {
            // O registro ligado (projeto, tarefa, voluntario) foi excluido por outra pessoa no meio.
            _logger.LogWarning(ex, "Registro ligado a outro que nao existe mais em {Path}", context.Request.Path);
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "Este registro está ligado a outro que foi excluído agora há pouco. Recarregue a tela e tente de novo.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro nao tratado em {Path}", context.Request.Path);
            await WriteAsync(context, StatusCodes.Status500InternalServerError,
                "Erro interno do servidor. Tente novamente em instantes.");
        }
    }

    private static async Task WriteAsync(HttpContext context, int status, string message)
    {
        if (context.Response.HasStarted) return;

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json; charset=utf-8";
        var payload = JsonSerializer.Serialize(new { message });
        await context.Response.WriteAsync(payload);
    }
}
