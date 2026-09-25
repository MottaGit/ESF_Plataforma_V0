using System.Text;
using System.Text.Json.Serialization;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// QuestPDF (geracao de relatorios): licenca comunitaria, uso gratuito por organizacoes sem fins lucrativos.
QuestPDF.Settings.License = LicenseType.Community;
QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;

// ---------- configuracao ----------
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.Configure<SeedOptions>(builder.Configuration.GetSection(SeedOptions.SectionName));

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (jwtOptions.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key deve ter ao menos 32 caracteres. Ajuste appsettings.json ou a variavel de ambiente Jwt__Key.");

// ---------- persistencia ----------
builder.Services.AddDbContext<EsfDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ---------- servicos de aplicacao ----------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<FileStorageService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ProjectService>();
builder.Services.AddScoped<ProgramService>();
builder.Services.AddScoped<ActivityService>();
builder.Services.AddScoped<VolunteerService>();
builder.Services.AddScoped<IndicatorService>();
builder.Services.AddScoped<ProjectFileService>();
builder.Services.AddScoped<ProjectUpdateService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<OrganizationService>();
builder.Services.AddScoped<ReportService>();

// ---------- autenticacao e autorizacao ----------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.ManageProjects, policy =>
        policy.RequireRole(nameof(UserRole.Administrador), nameof(UserRole.Coordenador)));

    options.AddPolicy(Policies.AdminOnly, policy =>
        policy.RequireRole(nameof(UserRole.Administrador)));
});

// ---------- API ----------
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    });

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    // Erros de validacao no mesmo formato dos erros de negocio: { message, errors }.
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(entry => entry.Value is not null && entry.Value.Errors.Count > 0)
            .ToDictionary(
                entry => entry.Key,
                entry => entry.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

        var first = errors.SelectMany(pair => pair.Value).FirstOrDefault() ?? "Dados invalidos.";
        return new BadRequestObjectResult(new { message = first, errors });
    };
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Content-Disposition");
        else
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Content-Disposition");
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "ESF - Plataforma de gestao de projetos",
        Version = "v0",
        Description = "API da V0 da plataforma de gestao de projetos sociais."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Informe o token retornado por POST /api/auth/login."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ---------- pipeline ----------
app.UseMiddleware<ErrorHandlingMiddleware>();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "ESF API v0");
    options.DocumentTitle = "ESF API";
});

app.UseCors();

// Arquivos enviados (fotos e documentos) servidos a partir do diretorio de uploads.
var storage = app.Services.GetRequiredService<FileStorageService>();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storage.Root),
    RequestPath = Mapping.UploadsUrlPrefix,
    ServeUnknownFileTypes = true,
    DefaultContentType = "application/octet-stream"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", at = DateTime.UtcNow }))
    .ExcludeFromDescription();

await PrepareDatabaseAsync(app);

app.Run();

// ---------- banco: migrations + dados iniciais ----------
static async Task PrepareDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var provider = scope.ServiceProvider;
    var logger = provider.GetRequiredService<ILogger<Program>>();
    var db = provider.GetRequiredService<EsfDbContext>();

    const int maxAttempts = 15;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            logger.LogInformation("Migrations aplicadas com sucesso.");
            break;
        }
        catch (Exception ex)
        {
            if (attempt == maxAttempts)
            {
                logger.LogError(ex, "Nao foi possivel conectar ao PostgreSQL apos {Attempts} tentativas.", maxAttempts);
                throw;
            }

            logger.LogWarning("PostgreSQL indisponivel (tentativa {Attempt}/{Max}). Nova tentativa em 3s.", attempt, maxAttempts);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }

    var seed = provider.GetRequiredService<IOptions<SeedOptions>>().Value;
    if (seed.Enabled)
        await DbSeeder.SeedAsync(db, seed.DemoPassword, logger);
}
