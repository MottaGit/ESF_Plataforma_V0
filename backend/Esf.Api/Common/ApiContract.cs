using System.Text.Json.Serialization;
using Microsoft.OpenApi.Models;
using Microsoft.OpenApi.Writers;
using Swashbuckle.AspNetCore.Swagger;

namespace Esf.Api.Common;

/// <summary>
/// O contrato da API: formato do JSON e documento OpenAPI (Swagger). O Program.cs e o teste que gera os tipos do
/// frontend (frontend/openapi.json → src/types/openapi.ts) usam as mesmas definicoes, entao o que a tela espera e o que
/// a API manda nao se separam.
/// </summary>
public static class ApiContract
{
    public const string DocumentName = "v1";

    /// <summary>Controllers com o JSON da API: enums como texto e toda propriedade sempre presente (null quando vazia).</summary>
    public static IMvcBuilder AddEsfControllers(this IServiceCollection services) =>
        services.AddControllers().AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        });

    public static IServiceCollection AddEsfSwagger(this IServiceCollection services) =>
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(DocumentName, new OpenApiInfo
            {
                Title = "ESF - Plataforma de gestao de projetos",
                Version = "v0",
                Description = "API da V0 da plataforma de gestao de projetos sociais."
            });

            // "string?" vira nullable e "string" nao (sem isto, todo texto parecia poder vir null), e uma referencia a
            // outro tipo que pode vir null tambem diz isso (allOf + nullable): os tipos gerados para o frontend
            // dependem dos dois.
            options.SupportNonNullableReferenceTypes();
            options.UseAllOfToExtendReferenceSchemas();

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

    /// <summary>O documento OpenAPI em JSON, com quebra de linha \n (o mesmo texto em qualquer sistema).</summary>
    public static string OpenApiJson(IServiceProvider services)
    {
        var document = services.GetRequiredService<ISwaggerProvider>().GetSwagger(DocumentName);
        using var text = new StringWriter();
        document.SerializeAsV3(new OpenApiJsonWriter(text));
        return text.ToString().Replace("\r\n", "\n") + "\n";
    }
}
