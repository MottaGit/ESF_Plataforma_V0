using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Esf.Api.Reports;

/// <summary>Dados do certificado de voluntariado, ja calculados e formatados.</summary>
public record CertificateModel(
    string OrganizationName,
    string? Cnpj,
    string? City,
    string VolunteerName,
    string? Cpf,
    int WeeklyHours,
    string StartDate,
    string EndDate,
    int TotalHours,
    string? SignatoryName,
    string? SignatoryRole,
    string? SignatoryNote,
    byte[]? Signature,
    byte[]? Logo);

/// <summary>
/// Certificado de participacao no voluntariado, no modelo usado pela organizacao: A4 deitado, faixas azuis nos
/// cantos, "CERTIFICADO" em destaque, o nome do voluntario, o periodo e o total de horas, com a assinatura de
/// quem assina pela organizacao e o logo.
/// </summary>
public static class CertificateBuilder
{
    private const string Ink = "#1B2028";
    private const string Navy = "#16213E";

    // Faixas onduladas nos cantos (pagina A4 deitada: 842 x 595 pt).
    private const string Decoration = """
        <svg xmlns="http://www.w3.org/2000/svg" width="842" height="595" viewBox="0 0 842 595">
          <path d="M842 0 L842 250 C790 228 770 160 712 122 C660 88 640 34 600 0 Z" fill="#1F2A5A" fill-opacity="0.28"/>
          <path d="M842 0 L842 178 C806 164 790 112 748 84 C712 60 702 22 678 0 Z" fill="#1F2A5A" fill-opacity="0.5"/>
          <path d="M842 64 C796 76 766 40 742 0" fill="none" stroke="#0F1A44" stroke-width="3"/>
          <path d="M842 128 C776 132 742 78 704 0" fill="none" stroke="#0F1A44" stroke-width="2"/>
          <path d="M0 595 L0 345 C52 367 72 435 130 473 C182 507 202 561 242 595 Z" fill="#1F2A5A" fill-opacity="0.28"/>
          <path d="M0 595 L0 417 C36 431 52 483 94 511 C130 535 140 573 164 595 Z" fill="#1F2A5A" fill-opacity="0.5"/>
          <path d="M0 531 C46 519 76 555 100 595" fill="none" stroke="#0F1A44" stroke-width="3"/>
          <path d="M0 467 C66 463 100 517 138 595" fill="none" stroke="#0F1A44" stroke-width="2"/>
        </svg>
        """;

    // Tres tracos acima do titulo, como no modelo.
    private const string Spark = """
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="34" viewBox="0 0 60 34">
          <path d="M30 3 L30 26" stroke="#1B2028" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M9 13 L18 27" stroke="#1B2028" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M51 13 L42 27" stroke="#1B2028" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
        """;

    public static byte[] Build(CertificateModel model) =>
        Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.Margin(0);
            page.PageColor(Colors.White);
            page.DefaultTextStyle(text => text.FontColor(Ink).FontSize(13).LineHeight(1.45f)
                .DisableFontFeature(FontFeatures.StandardLigatures));

            page.Background().Svg(Decoration);

            page.Content().PaddingHorizontal(90).PaddingTop(46).PaddingBottom(34).Column(col =>
            {
                col.Item().AlignCenter().Width(42).Svg(Spark);
                col.Item().AlignCenter().Text("CERTIFICADO").FontSize(56).Light().LetterSpacing(0.06f).FontColor(Ink);

                col.Item().PaddingTop(8).AlignCenter().Text(text =>
                {
                    text.AlignCenter();
                    text.Span(model.OrganizationName);
                    if (!string.IsNullOrWhiteSpace(model.Cnpj))
                    {
                        text.Span(", ");
                        text.Span($"CNPJ {model.Cnpj}").Bold();
                    }
                    text.Span(",");
                });
                col.Item().AlignCenter().Text(text =>
                {
                    text.AlignCenter();
                    if (string.IsNullOrWhiteSpace(model.Cpf))
                    {
                        text.Span("certifica");
                    }
                    else
                    {
                        text.Span("certifica o portador do CPF ");
                        text.Span(model.Cpf).Bold();
                        text.Span(",");
                    }
                });

                col.Item().PaddingVertical(12).AlignCenter().Text(model.VolunteerName)
                    .FontSize(36).Bold().FontColor(Navy).LineHeight(1.1f);

                col.Item().AlignCenter().Text(text =>
                {
                    text.AlignCenter();
                    text.Span("por prestar trabalho voluntário com média de ");
                    text.Span($"{model.WeeklyHours} {(model.WeeklyHours == 1 ? "hora semanal" : "horas semanais")}").Bold();
                    text.Span(", no período entre ");
                    text.Span(model.StartDate).Bold();
                    text.Span(" a ");
                    text.Span(model.EndDate).Bold();
                    text.Span(", dedicando-se de forma comprometida e responsável ao desenvolvimento de atividades " +
                              "relacionadas aos objetivos da organização, atuando em projetos sociais");
                    text.Span(string.IsNullOrWhiteSpace(model.City) ? "" : $" no município de {model.City}");
                    text.Span(", totalizando ");
                    text.Span($"{model.TotalHours} {(model.TotalHours == 1 ? "hora" : "horas")}").Bold();
                    text.Span(" no período.");
                });

                col.Item().ExtendVertical().AlignBottom().Row(row =>
                {
                    // Coluna vazia a esquerda para a assinatura ficar no centro e o logo a direita.
                    row.RelativeItem();
                    row.ConstantItem(300).Column(sign =>
                    {
                        if (model.Signature is not null)
                            sign.Item().AlignCenter().Height(46).Image(model.Signature).FitHeight();
                        else
                            sign.Item().Height(46);

                        sign.Item().PaddingHorizontal(20).LineHorizontal(1.2f).LineColor("#808080");
                        if (!string.IsNullOrWhiteSpace(model.SignatoryName))
                            sign.Item().PaddingTop(4).AlignCenter().Text(model.SignatoryName).FontSize(15);
                        if (!string.IsNullOrWhiteSpace(model.SignatoryRole))
                            sign.Item().AlignCenter().Text(model.SignatoryRole).FontSize(11.5f);
                        if (!string.IsNullOrWhiteSpace(model.SignatoryNote))
                            sign.Item().AlignCenter().Text(model.SignatoryNote).FontSize(11.5f);
                    });
                    row.RelativeItem().AlignRight().AlignBottom().Element(logo =>
                    {
                        if (model.Logo is not null) logo.Height(64).Image(model.Logo).FitArea();
                    });
                });
            });
        })).GeneratePdf();
}
