namespace Esf.Api.Common;

/// <summary>Erro de negocio previsto, convertido em resposta HTTP pelo middleware.</summary>
public class AppException : Exception
{
    public int StatusCode { get; }

    public AppException(string message, int statusCode = StatusCodes.Status400BadRequest) : base(message)
    {
        StatusCode = statusCode;
    }

    public static AppException NotFound(string what, bool feminine = false) =>
        new($"{what} nao encontrad{(feminine ? "a" : "o")}.", StatusCodes.Status404NotFound);

    public static AppException Conflict(string message) =>
        new(message, StatusCodes.Status409Conflict);

    public static AppException Forbidden(string message = "Voce nao tem permissao para esta acao.") =>
        new(message, StatusCodes.Status403Forbidden);
}
