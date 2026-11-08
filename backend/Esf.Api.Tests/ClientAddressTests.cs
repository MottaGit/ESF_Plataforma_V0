using System.Net;
using Esf.Api.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Esf.Api.Tests;

/// <summary>
/// Endereco de quem acessa atras do proxy: o limite de tentativas e o registro da assinatura usam o endereco que o
/// nosso proxy acrescentou, nunca o que o navegador mandou no cabecalho.
/// </summary>
public class ClientAddressTests
{
    private static async Task<(HttpContext Http, ForwardedHeadersOptions Options)> ThroughProxyAsync(
        Dictionary<string, string?> settings, params (string Name, string Value)[] headers)
    {
        var options = new ForwardedHeadersOptions();
        ClientAddress.Configure(options, new ConfigurationBuilder().AddInMemoryCollection(settings).Build());
        var middleware = new ForwardedHeadersMiddleware(_ => Task.CompletedTask, NullLoggerFactory.Instance, Options.Create(options));

        var http = new DefaultHttpContext();
        http.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.5"); // o proxy
        foreach (var (name, value) in headers) http.Request.Headers[name] = value;
        await middleware.Invoke(http);
        return (http, options);
    }

    [Fact]
    public async Task TakesTheAddressAddedByOurProxy()
    {
        var (http, options) = await ThroughProxyAsync(new(), ("X-Forwarded-For", "203.0.113.7"));

        Assert.Equal("203.0.113.7", ClientAddress.Format(http.Connection.RemoteIpAddress));
        Assert.Equal("203.0.113.7", ClientAddress.ForRecord(http, options.ForwardedForHeaderName));
    }

    [Fact]
    public async Task AddressInventedByTheBrowserIsNotTrusted()
    {
        // O navegador mandou "1.1.1.1"; o nosso proxy acrescentou o endereco real no fim.
        var (http, options) = await ThroughProxyAsync(new(), ("X-Forwarded-For", "1.1.1.1, 203.0.113.7"));

        Assert.Equal("203.0.113.7", ClientAddress.Format(http.Connection.RemoteIpAddress));
        Assert.Equal("203.0.113.7 (antes dele na cadeia, não conferido: 1.1.1.1)",
            ClientAddress.ForRecord(http, options.ForwardedForHeaderName));
    }

    [Fact]
    public async Task TwoProxiesInFrontWhenConfigured()
    {
        var (http, _) = await ThroughProxyAsync(new() { ["ForwardedHeaders:ForwardLimit"] = "2" },
            ("X-Forwarded-For", "1.1.1.1, 203.0.113.7, 172.18.0.3"));

        Assert.Equal("203.0.113.7", ClientAddress.Format(http.Connection.RemoteIpAddress));
    }

    [Fact]
    public async Task HeaderFilledByTheHostingWhenConfigured()
    {
        var (http, options) = await ThroughProxyAsync(new() { ["ForwardedHeaders:ClientIpHeader"] = "True-Client-IP" },
            ("True-Client-IP", "203.0.113.7"), ("X-Forwarded-For", "1.1.1.1, 104.16.0.1"));

        Assert.Equal("203.0.113.7", ClientAddress.Format(http.Connection.RemoteIpAddress));
        Assert.Equal("203.0.113.7", ClientAddress.ForRecord(http, options.ForwardedForHeaderName));
    }

    [Fact]
    public async Task WithoutProxyKeepsTheConnectionAddress()
    {
        var (http, options) = await ThroughProxyAsync(new());

        Assert.Equal("10.0.0.5", ClientAddress.ForRecord(http, options.ForwardedForHeaderName));
    }
}
