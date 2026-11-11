namespace Esf.Api.Common;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "esf-plataforma";
    public string Audience { get; set; } = "esf-plataforma-web";
    public string Key { get; set; } = string.Empty;
    public int ExpiresMinutes { get; set; } = 720;

    /// <summary>
    /// Chaves que estao (ou ja estiveram) no repositorio: com elas, quem le o codigo cria um token valido de qualquer
    /// perfil e nucleo. Servem so no ambiente de desenvolvimento.
    /// </summary>
    private static readonly HashSet<string> PublicKeys = new(StringComparer.Ordinal)
    {
        "troque-esta-chave-em-producao-com-no-minimo-32-caracteres",
        "chave-so-para-desenvolvimento-local-nunca-use-em-producao"
    };

    /// <summary>Motivo para a API nao subir com esta chave, ou null se ela serve.</summary>
    public static string? KeyProblem(string? key, bool isDevelopment)
    {
        if (string.IsNullOrEmpty(key) || key.Length < 32)
            return "Jwt:Key nao configurada ou com menos de 32 caracteres. Defina a variavel de ambiente Jwt__Key.";
        if (!isDevelopment && PublicKeys.Contains(key))
            return "Jwt:Key e uma chave de exemplo que esta no repositorio. Defina a variavel de ambiente Jwt__Key com um valor proprio.";
        return null;
    }
}

public class StorageOptions
{
    public const string SectionName = "Storage";

    public string UploadsPath { get; set; } = "App_Data/uploads";
    public int MaxFileSizeMb { get; set; } = 15;
}

public class SeedOptions
{
    public const string SectionName = "Seed";

    public bool Enabled { get; set; } = true;
    public string DemoPassword { get; set; } = "Esf@2026";
}

/// <summary>
/// Conta inicial da gestao nacional, criada na subida do servidor quando ainda nao existe nenhuma (variaveis
/// Nacional__AdminEmail e Nacional__AdminPassword). Se o e-mail ja for de um acesso de nucleo, ele ganha a permissao.
/// </summary>
public class NationalOptions
{
    public const string SectionName = "Nacional";

    public string? AdminEmail { get; set; }
    public string? AdminPassword { get; set; }
    public string AdminName { get; set; } = "Gestão nacional";
}
