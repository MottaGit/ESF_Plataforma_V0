using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using IElement = AngleSharp.Dom.IElement;

namespace Esf.Api.Reports;

/// <summary>
/// Desenha no PDF o texto formatado dos relatos (HTML ja limpo por RichText): paragrafos, listas,
/// negrito, italico, sublinhado, tachado e links. Qualquer outra marcacao vira texto simples.
/// </summary>
public static class RichTextPdf
{
    private static readonly HtmlParser Parser = new();

    private readonly record struct Style(bool Bold, bool Italic, bool Underline, bool Strike, string? Href);

    public static void Compose(IContainer container, string html, float fontSize)
    {
        var document = Parser.ParseDocument($"<body>{html}</body>");

        container.Column(column =>
        {
            column.Spacing(3);
            foreach (var node in document.Body!.ChildNodes)
                ComposeBlock(column, node, fontSize);
        });
    }

    private static void ComposeBlock(ColumnDescriptor column, INode node, float fontSize)
    {
        if (node is IElement { LocalName: "ul" or "ol" } list)
        {
            var number = 1;
            foreach (var item in list.Children.Where(child => child.LocalName == "li"))
            {
                var bullet = list.LocalName == "ol" ? $"{number++}." : "•";
                column.Item().PaddingLeft(4).Row(row =>
                {
                    row.ConstantItem(14).Text(bullet).FontSize(fontSize);
                    row.RelativeItem().Text(text => ComposeInline(text, item, fontSize, default));
                });
            }
            return;
        }

        // Paragrafo vazio (linha em branco) nao ocupa espaco no relatorio.
        if (string.IsNullOrWhiteSpace(node.TextContent)) return;

        column.Item().Text(text => ComposeInline(text, node, fontSize, default));
    }

    private static void ComposeInline(TextDescriptor text, INode node, float fontSize, Style style)
    {
        var first = true;
        foreach (var child in node.ChildNodes)
        {
            if (child is IText textNode)
            {
                AddSpan(text, textNode.Data, fontSize, style);
                continue;
            }

            if (child is not IElement element) continue;

            switch (element.LocalName)
            {
                case "br":
                    AddSpan(text, "\n", fontSize, style);
                    break;

                // Item de lista vem como <li><p>...</p></li>; varios paragrafos dentro dele viram linhas.
                case "p":
                    if (!first) AddSpan(text, "\n", fontSize, style);
                    ComposeInline(text, element, fontSize, style);
                    break;

                // Lista dentro de lista: cada item numa linha, com recuo simples.
                case "ul" or "ol":
                    foreach (var item in element.Children.Where(c => c.LocalName == "li"))
                    {
                        AddSpan(text, "\n   • ", fontSize, style);
                        ComposeInline(text, item, fontSize, style);
                    }
                    break;

                default:
                    ComposeInline(text, element, fontSize, element.LocalName switch
                    {
                        "strong" or "b" => style with { Bold = true },
                        "em" or "i" => style with { Italic = true },
                        "u" => style with { Underline = true },
                        "s" => style with { Strike = true },
                        "a" => style with { Href = element.GetAttribute("href") },
                        _ => style
                    });
                    break;
            }

            first = false;
        }
    }

    private static void AddSpan(TextDescriptor text, string value, float fontSize, Style style)
    {
        if (value.Length == 0) return;

        var span = style.Href is { Length: > 0 } href ? text.Hyperlink(value, href) : text.Span(value);
        span.FontSize(fontSize);
        if (style.Bold) span.SemiBold();
        if (style.Italic) span.Italic();
        if (style.Underline || style.Href is not null) span.Underline();
        if (style.Strike) span.Strikethrough();
    }
}
