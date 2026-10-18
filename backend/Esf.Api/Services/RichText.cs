using System.Net;
using System.Text.RegularExpressions;
using Ganss.Xss;

namespace Esf.Api.Services;

/// <summary>
/// Texto formatado dos relatos de andamento. O editor envia HTML; aqui ele e limpo para manter so
/// a formatacao permitida (paragrafos, negrito, italico, sublinhado, listas e links), sem scripts nem estilos.
/// </summary>
public static partial class RichText
{
    private static readonly HtmlSanitizer Sanitizer = CreateSanitizer();

    private static HtmlSanitizer CreateSanitizer()
    {
        var sanitizer = new HtmlSanitizer();

        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[] { "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a" })
            sanitizer.AllowedTags.Add(tag);

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in new[] { "href", "target", "rel" })
            sanitizer.AllowedAttributes.Add(attribute);

        sanitizer.AllowedSchemes.Clear();
        foreach (var scheme in new[] { "http", "https", "mailto" })
            sanitizer.AllowedSchemes.Add(scheme);

        sanitizer.AllowedCssProperties.Clear();
        sanitizer.AllowedAtRules.Clear();
        sanitizer.AllowedClasses.Clear();

        // Tag nao permitida (ex.: um <span> colado de outro lugar) perde a marcacao, mas o texto fica.
        // Exceto o conteudo de script/estilo e afins, que nao e texto do relato e e descartado.
        sanitizer.KeepChildNodes = true;
        sanitizer.RemovingTag += (_, args) =>
        {
            if (args.Tag.LocalName is "script" or "style" or "template" or "noscript" or "iframe" or "object" or "svg")
                args.Tag.InnerHtml = string.Empty;
        };

        // Links sempre abrem em outra aba, sem dar acesso a esta pagina.
        sanitizer.PostProcessNode += (_, args) =>
        {
            if (args.Node is AngleSharp.Dom.IElement { LocalName: "a" } link)
            {
                link.SetAttribute("target", "_blank");
                link.SetAttribute("rel", "noopener noreferrer nofollow");
            }
        };

        return sanitizer;
    }

    /// <summary>
    /// Limpa o HTML vindo do editor. Texto sem nenhuma marcacao (cliente antigo) vira paragrafos,
    /// preservando as quebras de linha.
    /// </summary>
    public static string Sanitize(string? input)
    {
        var value = (input ?? string.Empty).Trim();
        if (value.Length == 0) return string.Empty;

        if (!TagPattern().IsMatch(value))
            return FromPlainText(value);

        // Paragrafos vazios no comeco ou no fim (linhas em branco sobrando) nao fazem parte do relato.
        return EdgeEmptyParagraphPattern().Replace(Sanitizer.Sanitize(value).Trim(), string.Empty);
    }

    /// <summary>Texto sem marcacao, para validar tamanho minimo e para usos que nao suportam formatacao.</summary>
    public static string ToPlainText(string html)
    {
        var withBreaks = BlockEndPattern().Replace(html, " ");
        var withoutTags = AnyTagPattern().Replace(withBreaks, string.Empty);
        return WhitespacePattern().Replace(WebUtility.HtmlDecode(withoutTags), " ").Trim();
    }

    /// <summary>Converte texto puro em paragrafos HTML (uma linha por paragrafo).</summary>
    public static string FromPlainText(string text)
    {
        var lines = text.Replace("\r\n", "\n").Split('\n');
        return string.Concat(lines.Select(line => $"<p>{WebUtility.HtmlEncode(line)}</p>"));
    }

    [GeneratedRegex(@"<\s*/?\s*[a-zA-Z][^>]*>")]
    private static partial Regex TagPattern();

    [GeneratedRegex(@"^(\s*<p>\s*(<br\s*/?>)?\s*</p>)+|(\s*<p>\s*(<br\s*/?>)?\s*</p>)+$")]
    private static partial Regex EdgeEmptyParagraphPattern();

    [GeneratedRegex(@"<\s*(br|/p|/li)\s*/?>", RegexOptions.IgnoreCase)]
    private static partial Regex BlockEndPattern();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex AnyTagPattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();
}
