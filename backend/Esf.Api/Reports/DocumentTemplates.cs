using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Esf.Api.Reports;

/// <summary>
/// Modelos em PDF para imprimir e assinar: o termo de adesao do voluntario (com a autorizacao de uso de imagem)
/// e a autorizacao de uso de imagem dos beneficiarios de um projeto. CPF, RG e endereco ficam em branco para
/// preencher a mao: a plataforma nao guarda esses dados.
/// </summary>
public static class DocumentTemplates
{
    private const string Ink = "#1B2028";
    private const string Muted = "#667085";

    private static readonly Dictionary<VolunteerSector, string> SectorNames = new()
    {
        [VolunteerSector.Projetos] = "Projetos",
        [VolunteerSector.Juridico] = "Jurídico",
        [VolunteerSector.Pessoas] = "Pessoas",
        [VolunteerSector.Comunicacao] = "Comunicação",
        [VolunteerSector.Qualidade] = "Qualidade",
        [VolunteerSector.Financeiro] = "Financeiro"
    };

    public static byte[] VolunteerTerm(Organization org, Volunteer volunteer) =>
        Build(org, "TERMO DE ADESÃO AO SERVIÇO VOLUNTÁRIO E AUTORIZAÇÃO DE USO DE IMAGEM", col =>
        {
            col.Item().Text(text =>
            {
                text.Span("Pelo presente termo, de um lado ");
                text.Span(org.Name).SemiBold();
                if (!string.IsNullOrWhiteSpace(org.Cnpj)) text.Span($", inscrita no CNPJ sob o nº {org.Cnpj}");
                if (!string.IsNullOrWhiteSpace(org.City)) text.Span($", com sede em {CityAndState(org)}");
                text.Span(", doravante denominada ORGANIZAÇÃO, e de outro lado:");
            });

            col.Item().PaddingVertical(4).Column(person =>
            {
                person.Spacing(9);
                person.Item().Text(text =>
                {
                    text.Span("Nome: ");
                    text.Span(volunteer.Name).SemiBold();
                });
                person.Item().Text("CPF: ________________________________     RG: ________________________________");
                person.Item().Text("Endereço: ____________________________________________________________________________");
                person.Item().Text(
                    $"Telefone: {Blank(volunteer.Phone, 26)}     E-mail: {Blank(volunteer.Email, 34)}");
            });

            col.Item().Text(
                "doravante denominado(a) VOLUNTÁRIO(A), firmam o presente Termo de Adesão, nos termos da Lei nº 9.608, " +
                "de 18 de fevereiro de 1998, mediante as seguintes condições:");

            Clause(col, "1. Objeto.",
                "O(A) VOLUNTÁRIO(A) prestará serviço voluntário à ORGANIZAÇÃO, em atividades relacionadas aos seus " +
                $"objetivos institucionais, especialmente na área de {SectorNames.GetValueOrDefault(volunteer.Sector, "Projetos")}, " +
                "nos projetos sociais desenvolvidos pela ORGANIZAÇÃO.");
            Clause(col, "2. Gratuidade.",
                "O serviço voluntário não é remunerado e não gera vínculo empregatício nem obrigação de natureza " +
                "trabalhista, previdenciária ou afim (art. 1º, parágrafo único, da Lei nº 9.608/1998).");
            Clause(col, "3. Despesas.",
                "O(A) VOLUNTÁRIO(A) poderá ser ressarcido(a) das despesas que comprovadamente realizar no desempenho " +
                "das atividades, desde que previamente autorizadas pela ORGANIZAÇÃO (art. 3º da Lei nº 9.608/1998).");
            Clause(col, "4. Vigência.",
                "Este termo vigora por prazo indeterminado a partir da assinatura e pode ser encerrado por qualquer " +
                "das partes, a qualquer tempo, mediante simples comunicação.");
            Clause(col, "5. Compromissos.",
                "O(A) VOLUNTÁRIO(A) compromete-se a atuar com responsabilidade, respeitar as normas e os valores da " +
                "ORGANIZAÇÃO, e guardar sigilo sobre as informações e os dados pessoais a que tiver acesso, usando-os " +
                "somente nas atividades da ORGANIZAÇÃO.");
            Clause(col, "6. Uso de imagem.",
                "O(A) VOLUNTÁRIO(A) autoriza, de forma gratuita, o uso de sua imagem e voz, captadas durante as " +
                "atividades, em materiais institucionais, relatórios de prestação de contas, site e redes sociais da " +
                "ORGANIZAÇÃO, sem finalidade comercial. A autorização pode ser revogada a qualquer tempo, por " +
                "comunicação escrita, sem efeito sobre materiais já publicados.");
            col.Item().PaddingLeft(14).Text("(   ) Autorizo o uso da minha imagem          (   ) Não autorizo");
            Clause(col, "7. Dados pessoais.",
                "Os dados pessoais do(a) VOLUNTÁRIO(A) serão tratados conforme a Política de Privacidade da " +
                "ORGANIZAÇÃO e a Lei nº 13.709/2018 (LGPD), para a gestão do voluntariado e a prestação de contas.");

            Closing(col, org, ("VOLUNTÁRIO(A)", volunteer.Name), ("ORGANIZAÇÃO", OrgSignatory(org)));
        });

    // ---------- estrutura comum ----------

    private static byte[] Build(Organization org, string title, Action<ColumnDescriptor> body) =>
        Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(2, Unit.Centimetre);
            // Sem ligaduras ("ti", "fi"): senao o texto copiado do PDF perde letras ("atividades" vira "avidades").
            page.DefaultTextStyle(text => text.FontSize(10).FontColor(Ink).LineHeight(1.35f)
                .DisableFontFeature(FontFeatures.StandardLigatures));

            page.Header().Column(col =>
            {
                col.Item().Text(org.Name).SemiBold().FontSize(11);
                var identification = Identification(org);
                if (identification.Length > 0) col.Item().Text(identification).FontSize(9).FontColor(Muted);
            });

            page.Content().PaddingTop(16).Column(col =>
            {
                col.Spacing(7);
                col.Item().PaddingBottom(8).AlignCenter().Text(title).Bold().FontSize(12.5f);
                body(col);
            });

            page.Footer().AlignCenter().Text("Gerado pela plataforma de gestão de projetos — preencher, assinar e enviar a cópia assinada.")
                .FontSize(7.5f).FontColor(Muted);
        })).GeneratePdf();

    private static void Clause(ColumnDescriptor col, string title, string text) =>
        col.Item().Text(span =>
        {
            span.Justify();
            span.Span(title + " ").SemiBold();
            span.Span(text);
        });

    /// <summary>Local, data e assinaturas, sempre juntos na mesma pagina.</summary>
    private static void Closing(ColumnDescriptor col, Organization org, (string Role, string? Name) left,
        (string Role, string? Name) right) =>
        col.Item().PaddingTop(12).ShowEntire().Column(closing =>
        {
            closing.Item().Text(
                $"{(string.IsNullOrWhiteSpace(org.City) ? "______________________" : org.City)}, ____ de ____________________ de ________.");

            closing.Item().PaddingTop(38).Row(row =>
            {
                row.Spacing(36);
                foreach (var (role, name) in new[] { left, right })
                {
                    row.RelativeItem().Column(sign =>
                    {
                        sign.Item().LineHorizontal(0.8f).LineColor(Ink);
                        sign.Item().PaddingTop(4).AlignCenter().Text(name ?? " ").FontSize(9.5f);
                        sign.Item().AlignCenter().Text(role).FontSize(8.5f).FontColor(Muted);
                    });
                }
            });
        });

    private static string Identification(Organization org)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(org.Cnpj)) parts.Add($"CNPJ {org.Cnpj}");
        if (!string.IsNullOrWhiteSpace(org.City)) parts.Add(CityAndState(org));
        return string.Join(" · ", parts);
    }

    private static string CityAndState(Organization org) =>
        string.IsNullOrWhiteSpace(org.State) ? org.City! : $"{org.City}/{org.State}";

    /// <summary>Quem assina pela organizacao: "Nome — Cargo" quando configurado.</summary>
    private static string? OrgSignatory(Organization org) =>
        string.IsNullOrWhiteSpace(org.SignatoryName)
            ? null
            : string.IsNullOrWhiteSpace(org.SignatoryRole) ? org.SignatoryName : $"{org.SignatoryName} — {org.SignatoryRole}";

    /// <summary>Valor ja conhecido ou linha em branco para preencher.</summary>
    private static string Blank(string? value, int width) =>
        string.IsNullOrWhiteSpace(value) ? new string('_', width) : value;
}
