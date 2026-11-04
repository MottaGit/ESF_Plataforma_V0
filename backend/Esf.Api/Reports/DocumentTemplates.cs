using Esf.Api.Common;
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

    /// <summary>
    /// Versao do texto do termo de adesao. Ao mudar as clausulas, atualize a data: cada assinatura online guarda a
    /// versao que foi assinada.
    /// </summary>
    public const string VolunteerTermVersion = "2026-11-04";

    /// <summary>Texto do termo de adesao: o mesmo no PDF e na tela em que o voluntario le e assina.</summary>
    public static VolunteerTermText VolunteerTermContent(Organization org, Volunteer volunteer)
    {
        var opening = $"Pelo presente termo, de um lado {org.Name}";
        if (!string.IsNullOrWhiteSpace(org.Cnpj)) opening += $", inscrita no CNPJ sob o nº {org.Cnpj}";
        if (!string.IsNullOrWhiteSpace(org.City)) opening += $", com sede em {CityAndState(org)}";
        opening += ", doravante denominada ORGANIZAÇÃO, e de outro lado:";

        return new VolunteerTermText(
            "TERMO DE ADESÃO AO SERVIÇO VOLUNTÁRIO E AUTORIZAÇÃO DE USO DE IMAGEM",
            opening,
            "doravante denominado(a) VOLUNTÁRIO(A), firmam o presente Termo de Adesão, nos termos da Lei nº 9.608, " +
            "de 18 de fevereiro de 1998, mediante as seguintes condições:",
            new List<TermClause>
            {
                new("1. Objeto.",
                    "O(A) VOLUNTÁRIO(A) prestará serviço voluntário à ORGANIZAÇÃO, em atividades relacionadas aos seus " +
                    $"objetivos institucionais, especialmente na área de {SectorNames.GetValueOrDefault(volunteer.Sector, "Projetos")}, " +
                    "nos projetos sociais desenvolvidos pela ORGANIZAÇÃO."),
                new("2. Gratuidade.",
                    "O serviço voluntário não é remunerado e não gera vínculo empregatício nem obrigação de natureza " +
                    "trabalhista, previdenciária ou afim (art. 1º, parágrafo único, da Lei nº 9.608/1998)."),
                new("3. Despesas.",
                    "O(A) VOLUNTÁRIO(A) poderá ser ressarcido(a) das despesas que comprovadamente realizar no desempenho " +
                    "das atividades, desde que previamente autorizadas pela ORGANIZAÇÃO (art. 3º da Lei nº 9.608/1998)."),
                new("4. Vigência.",
                    "Este termo vigora por prazo indeterminado a partir da assinatura e pode ser encerrado por qualquer " +
                    "das partes, a qualquer tempo, mediante simples comunicação."),
                new("5. Compromissos.",
                    "O(A) VOLUNTÁRIO(A) compromete-se a atuar com responsabilidade, respeitar as normas e os valores da " +
                    "ORGANIZAÇÃO, e guardar sigilo sobre as informações e os dados pessoais a que tiver acesso, usando-os " +
                    "somente nas atividades da ORGANIZAÇÃO."),
                new(ImageClauseTitle,
                    "O(A) VOLUNTÁRIO(A) autoriza, de forma gratuita, o uso de sua imagem e voz, captadas durante as " +
                    "atividades, em materiais institucionais, relatórios de prestação de contas, site e redes sociais da " +
                    "ORGANIZAÇÃO, sem finalidade comercial. A autorização pode ser revogada a qualquer tempo, por " +
                    "comunicação escrita, sem efeito sobre materiais já publicados."),
                new("7. Dados pessoais.",
                    "Os dados pessoais do(a) VOLUNTÁRIO(A) serão tratados conforme a Política de Privacidade da " +
                    "ORGANIZAÇÃO e a Lei nº 13.709/2018 (LGPD), para a gestão do voluntariado e a prestação de contas.")
            });
    }

    /// <summary>Clausula seguida da escolha "Autorizo / Nao autorizo".</summary>
    public const string ImageClauseTitle = "6. Uso de imagem.";

    /// <summary>
    /// Termo de adesao (com autorizacao de uso de imagem). Sem <paramref name="signature"/>: para imprimir e assinar a
    /// mao, com CPF, RG e endereco em branco. Com ela: a via assinada online, com o registro da assinatura no fim.
    /// </summary>
    public static byte[] VolunteerTerm(Organization org, Volunteer volunteer, TermSignature? signature = null)
    {
        var content = VolunteerTermContent(org, volunteer);
        return Build(org, content.Title, col =>
        {
            col.Item().Text(content.Opening);

            col.Item().PaddingVertical(4).Column(person =>
            {
                person.Spacing(9);
                person.Item().Text(text =>
                {
                    text.Span("Nome: ");
                    text.Span(volunteer.Name).SemiBold();
                });
                if (signature is null)
                {
                    person.Item().Text("CPF: ________________________________     RG: ________________________________");
                    person.Item().Text("Endereço: ____________________________________________________________________________");
                }
                else
                {
                    person.Item().Text($"CPF: {signature.Cpf}");
                }
                person.Item().Text(
                    $"Telefone: {Blank(volunteer.Phone, 26)}     E-mail: {Blank(volunteer.Email, 34)}");
            });

            col.Item().Text(content.Commitment);

            foreach (var clause in content.Clauses)
            {
                Clause(col, clause.Title, clause.Text);
                if (clause.Title != ImageClauseTitle) continue;
                var (yes, no) = signature is null ? (" ", " ") : signature.ImageAuthorized ? ("X", " ") : (" ", "X");
                col.Item().PaddingLeft(14).Text($"(  {yes}  ) Autorizo o uso da minha imagem          (  {no}  ) Não autorizo");
            }

            if (signature is null)
                Closing(col, org, ("VOLUNTÁRIO(A)", volunteer.Name), ("ORGANIZAÇÃO", OrgSignatory(org)));
            else
                ElectronicClosing(col, org, signature);
        }, signature is null
            ? "Gerado pela plataforma de gestão de projetos — preencher, assinar e enviar a cópia assinada."
            : $"Documento assinado eletronicamente na plataforma de gestão de projetos · registro {signature.RecordId}");
    }

    /// <summary>
    /// Autorizacao de uso de imagem para uma familia atendida pelo projeto (uma por familia): quem autoriza
    /// preenche os proprios dados e, se houver, os das criancas e adolescentes de quem e responsavel.
    /// </summary>
    public static byte[] BeneficiaryImageAuthorization(Organization org, Project project) =>
        Build(org, "TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM", col =>
        {
            col.Item().Text(text =>
            {
                text.Span("Projeto: ");
                text.Span(project.Name).SemiBold();
            });
            var place = string.Join(", ", new[] { project.Address, project.District, project.City }
                .Where(part => !string.IsNullOrWhiteSpace(part)));
            if (place.Length > 0) col.Item().Text($"Local: {place}");

            col.Item().PaddingTop(4).Column(person =>
            {
                person.Spacing(9);
                person.Item().Text("Eu, __________________________________________________________________________,");
                person.Item().Text("CPF: ________________________________     RG: ________________________________");
                person.Item().Text("residente em: ________________________________________________________________,");
            });

            col.Item().Text(text =>
            {
                text.Justify();
                text.Span("autorizo, de forma gratuita, a ");
                text.Span(org.Name).SemiBold();
                if (!string.IsNullOrWhiteSpace(org.Cnpj)) text.Span($", CNPJ {org.Cnpj}");
                text.Span(
                    ", a usar a minha imagem e voz e as das pessoas de quem sou responsável legal, listadas abaixo, " +
                    "captadas em fotos e vídeos durante o projeto acima, em relatórios de prestação de contas a " +
                    "parceiros e financiadores, em materiais institucionais, no site e nas redes sociais da " +
                    "organização, sem finalidade comercial.");
            });

            col.Item().PaddingTop(2).Text("Crianças e adolescentes de quem sou responsável (nome e idade):").SemiBold();
            for (var i = 0; i < 3; i++)
                col.Item().Text("______________________________________________________________   Idade: ______");

            Clause(col, "Condições.",
                "A autorização não envolve pagamento de qualquer natureza e vale enquanto as imagens forem usadas " +
                "para os fins acima. Pode ser revogada a qualquer tempo, por comunicação à organização, sem efeito " +
                "sobre materiais já publicados. Os dados deste termo são tratados conforme a Lei nº 13.709/2018 " +
                "(LGPD) e o Estatuto da Criança e do Adolescente.");

            Closing(col, org, ("QUEM AUTORIZA", null), ("ORGANIZAÇÃO", OrgSignatory(org)));
        });

    // ---------- estrutura comum ----------

    private static byte[] Build(Organization org, string title, Action<ColumnDescriptor> body,
        string footer = "Gerado pela plataforma de gestão de projetos — preencher, assinar e enviar a cópia assinada.") =>
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

            page.Footer().AlignCenter().Text(footer).FontSize(7.5f).FontColor(Muted);
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

    /// <summary>
    /// Fim da via assinada online: local e data, o registro da assinatura eletronica (quem, CPF, conta, quando, de onde)
    /// e quem responde pela organizacao, que emitiu o termo pela plataforma.
    /// </summary>
    private static void ElectronicClosing(ColumnDescriptor col, Organization org, TermSignature signature)
    {
        var local = TextHelpers.BrasiliaTime(signature.SignedAtUtc);
        col.Item().PaddingTop(12).ShowEntire().Column(closing =>
        {
            closing.Spacing(8);
            closing.Item().Text(
                $"{(string.IsNullOrWhiteSpace(org.City) ? "" : org.City + ", ")}{TextHelpers.LongDate(DateOnly.FromDateTime(local))}.");

            closing.Item().PaddingTop(6).Border(0.8f).BorderColor("#C8CDD5").Padding(12).Column(box =>
            {
                box.Spacing(4);
                box.Item().Text("ASSINATURA ELETRÔNICA DO(A) VOLUNTÁRIO(A)").SemiBold().FontSize(9);
                box.Item().Text(text =>
                {
                    text.Span("Assinado eletronicamente por ");
                    text.Span(signature.SignerName).SemiBold();
                    text.Span($", CPF {signature.Cpf}, na conta {signature.AccountEmail} da plataforma, em " +
                              $"{local:dd/MM/yyyy} às {local:HH:mm} (horário de Brasília)");
                    text.Span(string.IsNullOrWhiteSpace(signature.Ip) ? "." : $", a partir do endereço de rede {signature.Ip}.");
                });
                box.Item().Text(
                    "O(A) VOLUNTÁRIO(A) leu o termo, declarou concordar com ele e confirmou a assinatura digitando o " +
                    "nome completo. Assinatura eletrônica nos termos do art. 10, § 2º, da Medida Provisória nº " +
                    "2.200-2/2001. O registro da assinatura e o código de integridade deste arquivo ficam guardados " +
                    "pela ORGANIZAÇÃO.").FontSize(8.5f).FontColor(Muted);
                box.Item().Text($"Registro {signature.RecordId} · versão do termo {VolunteerTermVersion}")
                    .FontSize(8.5f).FontColor(Muted);
            });

            var signatory = OrgSignatory(org);
            closing.Item().PaddingTop(4).Text(signatory is null
                ? "Pela ORGANIZAÇÃO: termo emitido pela organização na plataforma."
                : $"Pela ORGANIZAÇÃO: {signatory} (termo emitido pela organização na plataforma).").FontSize(9);
        });
    }

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

/// <summary>Texto do termo de adesao: abertura, a frase que liga o voluntario ao termo e as clausulas.</summary>
public record VolunteerTermText(string Title, string Opening, string Commitment, IReadOnlyList<TermClause> Clauses);

public record TermClause(string Title, string Text);

/// <summary>Dados da assinatura online que vao para o PDF assinado.</summary>
public record TermSignature(
    Guid RecordId,
    string SignerName,
    string Cpf,
    string AccountEmail,
    DateTime SignedAtUtc,
    string? Ip,
    bool ImageAuthorized);
