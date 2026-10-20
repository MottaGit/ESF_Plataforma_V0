using System.Text;
using System.Text.Json.Serialization;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
// O interceptador grava o historico de alteracoes (quem mudou o que) no mesmo SaveChanges da alteracao.
builder.Services.AddSingleton<AuditInterceptor>();
builder.Services.AddDbContext<EsfDbContext>((services, options) =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .AddInterceptors(services.GetRequiredService<AuditInterceptor>()));

// ---------- servicos de aplicacao ----------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddScoped<FileStorageService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ProjectService>();
builder.Services.AddScoped<ProgramService>();
builder.Services.AddScoped<ActivityService>();
builder.Services.AddScoped<VolunteerService>();
builder.Services.AddScoped<VolunteerStatusHistoryService>();
builder.Services.AddScoped<IndicatorService>();
builder.Services.AddScoped<ProjectFileService>();
builder.Services.AddScoped<ProjectUpdateService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<OrganizationService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<SignedDocumentService>();
builder.Services.AddScoped<CertificateService>();
builder.Services.AddScoped<AuditService>();

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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Arquivos enviados (fotos e documentos), guardados no banco. Publicos como antes (as tags <img> nao mandam
// token) e com nome unico e imutavel, entao o navegador pode guardar em cache por muito tempo.
app.MapGet($"{Mapping.UploadsUrlPrefix}/{{name}}", async (string name, FileStorageService storage, HttpContext http) =>
    {
        var file = await storage.FindAsync(name);
        if (file is null) return Results.NotFound();

        http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        http.Response.Headers["X-Content-Type-Options"] = "nosniff";
        return Results.File(file.Value.Content, file.Value.ContentType);
    })
    .AllowAnonymous()
    .ExcludeFromDescription();

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

    // Arquivos de versoes anteriores (gravados em disco) que ainda existirem passam para o banco.
    try
    {
        var imported = await provider.GetRequiredService<FileStorageService>()
            .ImportLegacyFilesAsync(app.Environment.ContentRootPath);
        if (imported > 0) logger.LogInformation("{Count} arquivo(s) da pasta de uploads copiado(s) para o banco.", imported);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Nao foi possivel copiar os arquivos antigos da pasta de uploads para o banco.");
    }
}
