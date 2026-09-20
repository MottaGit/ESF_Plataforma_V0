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
