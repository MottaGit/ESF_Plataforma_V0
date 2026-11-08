using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Esf.Api.Common;

/// <summary>
/// Endereco de rede de quem acessa. A API fica atras de proxy (nginx do Docker, balanceador e Cloudflare da
/// hospedagem), entao a conexao chega sempre do proxy; o endereco real vem num cabecalho que cada proxy acrescenta
/// (X-Forwarded-For) ou que o Cloudflare preenche (True-Client-IP, CF-Connecting-IP). O ForwardedHeadersMiddleware
/// troca o endereco da conexao pelo do cabecalho, e o limite de tentativas e o registro da assinatura usam esse.
/// </summary>
public static class ClientAddress
{
    public const string SectionName = "ForwardedHeaders";

    /// <summary>
    /// ForwardLimit: quantos proxies nossos ficam na frente da API (padrao 1). A cadeia do X-Forwarded-For e lida da
    /// direita para a esquerda, entao so os ultimos enderecos, acrescentados pelos nossos proxies, sao aceitos; o que o
    /// navegador mandou antes deles (e poderia ser inventado) fica de fora. ClientIpHeader: outro cabecalho com o
    /// endereco real, quando a hospedagem preenche um (no Render, que tem o Cloudflare na frente, True-Client-IP).
    /// </summary>
    public static void Configure(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        var section = configuration.GetSection(SectionName);
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
        // Os enderecos dos proxies da hospedagem mudam; o que limita a confianca e o ForwardLimit.
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
        options.ForwardLimit = Math.Max(1, section.GetValue("ForwardLimit", 1));
        var header = section.GetValue<string>("ClientIpHeader");
        if (!string.IsNullOrWhiteSpace(header)) options.ForwardedForHeaderName = header.Trim();
    }

    /// <summary>"203.0.113.7" (IPv4 dentro de IPv6 volta a ser IPv4).</summary>
    public static string? Format(IPAddress? address) =>
        address is null ? null : (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString();

    /// <summary>
    /// Endereco para o registro da assinatura: o que o middleware aceitou e, se a cadeia trazia outros antes dele
    /// (que ninguem conferiu), esses vao junto, marcados como nao conferidos.
    /// </summary>
    public static string? ForRecord(HttpContext http, string forwardedForHeaderName)
    {
        var ip = Format(http.Connection.RemoteIpAddress);
        // Depois do middleware, o cabecalho guarda so o que sobrou da cadeia (o que nao foi aceito).
        var unverified = http.Request.Headers[forwardedForHeaderName].ToString().Trim();
        if (string.IsNullOrEmpty(unverified)) return ip;
        return ip is null ? $"não conferido: {unverified}" : $"{ip} (antes dele na cadeia, não conferido: {unverified})";
    }
}
