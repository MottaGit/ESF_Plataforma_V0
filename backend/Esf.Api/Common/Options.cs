namespace Esf.Api.Common;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "esf-plataforma";
    public string Audience { get; set; } = "esf-plataforma-web";
    public string Key { get; set; } = string.Empty;
    public int ExpiresMinutes { get; set; } = 720;
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
