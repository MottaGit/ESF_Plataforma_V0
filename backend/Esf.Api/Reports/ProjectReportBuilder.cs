using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Esf.Api.Reports;

/// <summary>
/// Relatorio de projeto em PDF: um resumo enxuto (identificacao, indicadores, equipe)
/// seguido da linha do tempo de atualizacoes com as fotos de cada evento - pensado para
/// prestacao de contas a parceiros, nao como export operacional do sistema.
/// </summary>
public static class ProjectReportBuilder
{
    private const string Ink = "#1B2028";
    private const string Muted = "#667085";
    private const string Line = "#DDE1E6";
    private const string SoftBg = "#F4F6F8";
    private const string Accent = "#10564A";

    private static readonly string[] MonthAbbreviations =
    {
        "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
    };

    public static byte[] Build(ReportModel model)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.6f, Unit.Centimetre);
                page.DefaultTextStyle(text => text.FontSize(9.5f).FontColor(Ink).LineHeight(1.3f));

                // Primeira pagina com a abertura (logo, titulo, periodo, quem emitiu); as demais, so uma linha.
                page.Header().Column(header =>
                {
                    header.Item().ShowOnce().Element(c => ComposeCover(c, model));
                    header.Item().SkipOnce().Element(c => ComposeRunningHeader(c, model));
                });
                page.Content().PaddingVertical(14).Element(c => ComposeContent(c, model));
                page.Footer().Element(c => ComposeFooter(c, model));
            });
        })
        .WithMetadata(new DocumentMetadata
        {
            Title = $"{model.Kicker} {model.Title} · {model.PeriodName ?? model.PeriodDates}",
            Author = model.Organization.Name,
            Subject = "Relatório de projetos e resultados"
        })
        .GeneratePdf();
    }

    /// <summary>"3º trimestre de 2026 · 01/07/2026 a 30/09/2026"; sem periodo, o dia da situacao.</summary>
    private static string ReportPeriodLine(ReportModel model)
    {
        if (!model.HasPeriod)
            return $"Situação em {TextHelpers.BrasiliaDay(model.GeneratedAt):dd/MM/yyyy}";
        return model.PeriodName is { } name ? $"{Capitalize(name)} · {model.PeriodDates}" : Capitalize(model.PeriodDates);
    }

    private static string Capitalize(string text) => text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..];

    /// <summary>Abertura da primeira pagina: logo e nucleo, quem emitiu, e o titulo pelo recorte com o periodo.</summary>
    private static void ComposeCover(IContainer container, ReportModel model)
    {
        container.Column(col =>
        {
            col.Item().BorderBottom(1).BorderColor(Line).PaddingBottom(8).Row(row =>
            {
                if (model.Logo is { } logo)
                    row.ConstantItem(64).Height(40).AlignLeft().AlignMiddle().Image(logo).FitArea();

                row.RelativeItem().AlignMiddle().PaddingLeft(model.Logo is null ? 0 : 8).Column(org =>
                {
                    org.Item().Text(model.Organization.Name).FontSize(12).SemiBold();
                    if (!string.IsNullOrWhiteSpace(model.Organization.LegalName))
                        org.Item().Text(model.Organization.LegalName!).FontSize(8).FontColor(Muted);
                });

                row.ConstantItem(170).AlignRight().AlignMiddle().Column(issued =>
                {
                    issued.Item().AlignRight()
                        .Text($"Emitido em {TextHelpers.BrasiliaTime(model.GeneratedAt):dd/MM/yyyy HH:mm}")
                        .FontSize(8).FontColor(Muted);
                    issued.Item().AlignRight().Text($"por {model.GeneratedBy}").FontSize(8).FontColor(Muted);
                });
            });

            col.Item().PaddingTop(12).Text(model.Kicker.ToUpperInvariant()).FontSize(8).SemiBold().FontColor(Muted)
                .LetterSpacing(0.05f);
            col.Item().Text(model.Title).FontSize(18).SemiBold();
            col.Item().PaddingTop(2).Text(ReportPeriodLine(model)).FontSize(9.5f).SemiBold().FontColor(Accent);
        });
    }

    /// <summary>Cabecalho das paginas seguintes: nucleo, titulo e periodo numa linha so.</summary>
    private static void ComposeRunningHeader(IContainer container, ReportModel model)
    {
        container
            .BorderBottom(1)
            .BorderColor(Line)
            .PaddingBottom(5)
            .Row(row =>
            {
                row.RelativeItem().Text(text =>
                {
                    text.Span(model.Organization.Name).FontSize(8).SemiBold();
                    text.Span($" · {model.Kicker} {model.Title}").FontSize(8).FontColor(Muted);
                });
                row.ConstantItem(170).AlignRight()
                    .Text(model.HasPeriod ? Capitalize(model.PeriodName ?? model.PeriodDates) : "")
                    .FontSize(8).FontColor(Muted);
            });
    }

    private static void ComposeFooter(IContainer container, ReportModel model)
    {
        container
            .BorderTop(1)
            .BorderColor(Line)
            .PaddingTop(6)
            .Row(row =>
            {
                row.RelativeItem().Text(FooterIdentity(model.Organization)).FontSize(7.5f).FontColor(Muted);

                row.ConstantItem(70).AlignRight().Text(text =>
                {
                    text.Span("Página ").FontSize(7.5f).FontColor(Muted);
                    text.CurrentPageNumber().FontSize(7.5f).FontColor(Muted);
                    text.Span(" de ").FontSize(7.5f).FontColor(Muted);
                    text.TotalPages().FontSize(7.5f).FontColor(Muted);
                });
            });
    }

    private static string FooterIdentity(Organization o)
    {
        var parts = new List<string>
        {
            !string.IsNullOrWhiteSpace(o.LegalName) ? o.LegalName! : o.Name
        };

        if (!string.IsNullOrWhiteSpace(o.Cnpj))
            parts.Add($"CNPJ {o.Cnpj}");

        var contact = o.Email ?? o.Website;
        if (!string.IsNullOrWhiteSpace(contact))
            parts.Add(contact!);

        return string.Join(" · ", parts);
    }

    private static string SectionOf(Project p) => $"projeto-{p.Id:N}";

    private static void ComposeContent(IContainer container, ReportModel model)
    {
        container.Column(col =>
        {
            col.Spacing(16);

            if (!string.IsNullOrWhiteSpace(model.Note))
            {
                col.Item().Background(SoftBg).Padding(10).Column(note =>
                {
                    note.Item().Text("Sobre este relatório").FontSize(9).SemiBold();
                    note.Item().PaddingTop(2).Text(model.Note!).FontSize(9).FontColor(Muted);
                });
            }

            // O resumo e so a abertura (mesmo com um projeto); o completo abre assim quando tem mais de um.
            var opening = model.Summary || model.Projects.Count > 1;
            if (opening)
            {
                if (model.SingleProgram is { } program && HasSheet(program))
                    col.Item().Element(c => ComposeProgramSheet(c, program));
                col.Item().Element(c => ComposeResults(c, model));
                col.Item().Element(c => ComposeSummary(c, model));
            }

            // Cada projeto comeca numa pagina (da para imprimir ou mandar so o dele); a secao leva o sumario ate ele.
            if (!model.Summary)
                foreach (var (project, index) in model.Projects.Select((p, i) => (p, i)))
                {
                    if (opening || index > 0)
                        col.Item().PageBreak();
                    col.Item().Section(SectionOf(project)).Element(c => ComposeProject(c, model, project));
                }

            col.Item().Element(c => ComposeAbout(c, model.Organization));
        });
    }

    private static bool HasSheet(ProjectProgram program) =>
        !string.IsNullOrWhiteSpace(program.Description)
        || !string.IsNullOrWhiteSpace(program.Objective)
        || !string.IsNullOrWhiteSpace(program.Audience);

    /// <summary>Ficha do programa (a mesma da pagina publica) abrindo o relatorio de um programa so.</summary>
    private static void ComposeProgramSheet(IContainer container, ProjectProgram program)
    {
        container.Column(col =>
        {
            col.Spacing(6);
            col.Item().Text("Sobre o programa").FontSize(11).SemiBold();
            foreach (var (label, text) in new[]
                     {
                         ("O que faz", program.Description),
                         ("Objetivo", program.Objective),
                         ("Para quem", program.Audience)
                     })
            {
                if (string.IsNullOrWhiteSpace(text)) continue;
                col.Item().Column(item =>
                {
                    item.Item().Text(label).FontSize(8).SemiBold().FontColor(Muted);
                    item.Item().Text(text!.Trim());
                });
            }
        });
    }

    /// <summary>Fecho do relatorio: quem e o nucleo (missao, apresentacao) e como falar com ele.</summary>
    private static void ComposeAbout(IContainer container, Organization o)
    {
        var contacts = new[]
            {
                string.IsNullOrWhiteSpace(o.Cnpj) ? null : $"CNPJ {o.Cnpj}",
                o.Email,
                o.Phone,
                o.Website,
                string.Join("/", new[] { o.City, o.State }.Where(x => !string.IsNullOrWhiteSpace(x)))
            }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList();

        container.EnsureSpace(110).PaddingTop(8).BorderTop(1).BorderColor(Line).PaddingTop(10).Column(col =>
        {
            col.Spacing(5);
            col.Item().Text("Quem somos").FontSize(11).SemiBold();
            col.Item().Text(!string.IsNullOrWhiteSpace(o.LegalName) ? o.LegalName! : o.Name).SemiBold();
            if (!string.IsNullOrWhiteSpace(o.Mission))
                col.Item().Column(item =>
                {
                    item.Item().Text("Missão").FontSize(8).SemiBold().FontColor(Muted);
                    item.Item().Text(o.Mission!.Trim());
                });
            if (!string.IsNullOrWhiteSpace(o.About))
                col.Item().Text(o.About!.Trim());
            if (contacts.Count > 0)
                col.Item().Text(string.Join(" · ", contacts)).FontSize(8.5f).FontColor(Muted);
        });
    }

    /// <summary>
    /// Abertura do relatorio de varios projetos: numeros gerais (projetos por status, equipe, registros, tarefas
    /// concluidas e horas) e os indicadores padrao de cada programa somados nos projetos do relatorio. Com periodo, o que
    /// aconteceu nele fica separado do que e acumulado (quem lia "jul-set · 120 pessoas" entendia que as 120 eram do
    /// trimestre), e os indicadores dizem quanto mudaram no periodo.
    /// </summary>
    private static void ComposeResults(IContainer container, ReportModel model)
    {
        var projects = model.Projects;
        var volunteers = projects.SelectMany(p => p.Volunteers).Select(v => v.VolunteerId).Distinct().Count();
        var updates = projects.SelectMany(p => p.Updates).Count(u => model.InPeriod(u.Day));
        var doneTasks = projects.SelectMany(p => p.Activities)
            .Count(a => a.Status == ActivityStatus.Concluida && a.CompletedAt.HasValue && model.InPeriod(a.CompletedAt.Value));
        var hours = projects.Sum(p => model.HoursOf(p.Id));
        var concluded = projects.Count(p => p.Status == ProjectStatus.Concluido && p.ClosedOn is { } day && model.InPeriod(day));
        var byStatus = string.Join(" · ", projects
            .GroupBy(p => p.Status)
            .OrderBy(g => g.Key)
            .Select(g => StatusCount(g.Key, g.Count())));
        var projectsLabel = projects.Count == 1 ? "projeto" : "projetos";
        var today = TextHelpers.BrasiliaDay(model.GeneratedAt).ToString("dd/MM/yyyy");
        var asOf = model.AsOf.ToString("dd/MM/yyyy");

        container.EnsureSpace(150).Column(col =>
        {
            col.Spacing(8);
            col.Item().Text("Resultados").FontSize(11).SemiBold();

            if (model.HasPeriod)
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem(2).PaddingRight(6).Element(c =>
                        StatCard(c, Number(projects.Count), projectsLabel, $"situação em {today}: {byStatus}"));
                    row.RelativeItem().PaddingRight(6).Element(c => StatCard(c, Number(volunteers), "voluntários nas equipes", null));
                    row.RelativeItem();
                });

                col.Item().Element(c => BandTitle(c, $"No período · {model.PeriodName ?? model.PeriodDates}"));
                var period = new List<(string, string, string?)>
                {
                    (Number(concluded), concluded == 1 ? "projeto concluído" : "projetos concluídos", null),
                    (Number(doneTasks), "tarefas concluídas", null),
                    (Number(updates), "registros de andamento", null)
                };
                if (hours > 0)
                    period.Add((TextHelpers.Hours(hours), "horas de voluntariado lançadas", null));
                col.Item().Element(c => StatRow(c, period.ToArray()));

                if (model.ProgramResults.Any(r => r.Results.Count > 0))
                    col.Item().Element(c => BandTitle(c, $"Indicadores acumulados até {asOf}"));
            }
            else
            {
                col.Item().Element(c => StatRow(c,
                    (Number(projects.Count), projectsLabel, byStatus),
                    (Number(volunteers), "voluntários nas equipes",
                        hours > 0 ? $"{TextHelpers.Hours(hours)} horas de voluntariado lançadas" : null),
                    (Number(updates), "registros de andamento", null),
                    (Number(doneTasks), "tarefas concluídas", null)));
            }

            foreach (var program in model.ProgramResults.Where(r => r.Results.Count > 0 || model.PartnersLine(r.ProgramId) != null))
            {
                col.Item().PaddingTop(4).ShowEntire().Column(block =>
                {
                    block.Item().Text(text =>
                    {
                        text.Span(program.Program).FontSize(9.5f).SemiBold();
                        text.Span($" · {program.Projects} {(program.Projects == 1 ? "projeto" : "projetos")}")
                            .FontSize(8.5f).FontColor(Muted);
                    });
                    // No resumo nao ha capitulo de projeto: os parceiros aparecem aqui, embaixo do programa.
                    var partners = model.PartnersLine(program.ProgramId);
                    if (partners != null)
                        block.Item().Text(text =>
                        {
                            text.Span("Parceiros: ").FontSize(8.5f).SemiBold().FontColor(Ink);
                            text.Span(partners).FontSize(8.5f).FontColor(Muted);
                        });

                    foreach (var chunk in program.Results.Chunk(4))
                    {
                        block.Item().PaddingTop(4).Row(row =>
                        {
                            foreach (var result in chunk)
                                row.RelativeItem().PaddingRight(6)
                                    .Element(c => ValueCard(c, result.Total, result.Unit, result.Name,
                                        ChangeText(model, result.Change),
                                        ResultTotals.Coverage(result.Informed, result.Projects)));

                            for (var pad = chunk.Length; pad < 4; pad++)
                                row.RelativeItem();
                        });
                    }
                });
            }

            if (model.ProgramResults.Any(r => r.Results.Count > 0))
                col.Item().Text(model.ShowsChange
                        ? $"Indicadores somados nos projetos deste relatório (só os valores informados), com o valor de {asOf} e quanto mudou no período."
                        : $"Indicadores somados nos projetos deste relatório (só os valores informados), com os valores de {asOf}.")
                    .FontSize(7.5f).FontColor(Muted);
        });
    }

    /// <summary>Titulo de uma faixa do bloco Resultados ("No período · ...", "Indicadores acumulados até ...").</summary>
    private static void BandTitle(IContainer container, string title) =>
        container.PaddingTop(2).Text(title).FontSize(9).SemiBold().FontColor(Accent);

    /// <summary>Linha de ate 4 cartoes de numero, sempre na mesma largura (sobra espaco a direita quando sao menos).</summary>
    private static void StatRow(IContainer container, params (string Value, string Label, string? Detail)[] cards)
    {
        container.Row(row =>
        {
            for (var i = 0; i < 4; i++)
            {
                var item = row.RelativeItem();
                if (i < 3) item = item.PaddingRight(6);
                if (i < cards.Length)
                {
                    var card = cards[i];
                    item.Element(c => StatCard(c, card.Value, card.Label, card.Detail));
                }
            }
        });
    }

    private static void StatCard(IContainer container, string value, string label, string? detail)
    {
        container
            .Border(1)
            .BorderColor(Line)
            .Padding(8)
            .Column(card =>
            {
                card.Item().Text(value).FontSize(16).SemiBold().FontColor(Ink);
                card.Item().Text(label).FontSize(8).FontColor(Muted);
                if (!string.IsNullOrWhiteSpace(detail))
                    card.Item().PaddingTop(2).Text(detail!).FontSize(7.5f).FontColor(Muted);
            });
    }

    /// <summary>"+12 no período" / "−3 no período"; nada sem inicio de periodo ou quando o numero nao mudou.</summary>
    private static string? ChangeText(ReportModel model, decimal change) =>
        !model.ShowsChange || change == 0
            ? null
            : $"{(change > 0 ? "+" : "−")}{Number(Math.Abs(change))} no período";

    /// <summary>"Concluídos: 2" por extenso, no plural quando precisa ("2 concluídos · 1 em andamento").</summary>
    private static string StatusCount(ProjectStatus status, int count) => status switch
    {
        ProjectStatus.Planejamento => $"{count} em planejamento",
        ProjectStatus.EmAndamento => $"{count} em andamento",
        ProjectStatus.Pausado => $"{count} {(count == 1 ? "pausado" : "pausados")}",
        ProjectStatus.Concluido => $"{count} {(count == 1 ? "concluído" : "concluídos")}",
        ProjectStatus.Cancelado => $"{count} {(count == 1 ? "cancelado" : "cancelados")}",
        _ => $"{count} {status}"
    };

    /// <summary>
    /// Tabela dos projetos, na ordem do PDF (programa e nome): status, equipe, registros no periodo e uma coluna por
    /// indicador nacional (os comuns a todo projeto). Indicador vazio e "nao informado", nunca zero. No Completo ela e
    /// tambem o sumario: o nome leva ao capitulo do projeto e a ultima coluna diz a pagina.
    /// </summary>
    private static void ComposeSummary(IContainer container, ReportModel model)
    {
        var nationals = model.Projects
            .SelectMany(p => p.Indicators)
            .Where(i => i.NationalIndicatorId != null)
            .GroupBy(i => i.NationalIndicatorId!.Value)
            .Select(g => (Id: g.Key, g.First().Name))
            .OrderBy(n => SearchText.Fold(n.Name))
            .ToList();
        decimal? NationalValue(Project p, Guid id) =>
            p.Indicators.FirstOrDefault(i => i.NationalIndicatorId == id) is { } indicator ? model.Figure(indicator).Value : null;
        var anyMissing = model.Projects.Any(p => nationals.Any(n => NationalValue(p, n.Id) == null));
        var withPages = !model.Summary;

        container.EnsureSpace(80).Column(col =>
        {
            col.Item().Text("Resumo dos projetos").FontSize(11).SemiBold();
            col.Item().PaddingTop(6).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(5);
                    columns.ConstantColumn(66);
                    columns.ConstantColumn(42);
                    columns.ConstantColumn(56);
                    foreach (var _ in nationals)
                        columns.RelativeColumn(1.6f);
                    if (withPages)
                        columns.ConstantColumn(34);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Projeto");
                    header.Cell().Element(HeadCell).Text("Status");
                    header.Cell().Element(HeadCell).AlignRight().Text("Equipe");
                    header.Cell().Element(HeadCell).AlignRight().Text(model.HasPeriod ? "Registros no período" : "Registros");
                    foreach (var national in nationals)
                        header.Cell().Element(HeadCell).AlignRight().Text(national.Name);
                    if (withPages)
                        header.Cell().Element(HeadCell).AlignRight().Text("Pág.");
                });

                foreach (var p in model.Projects)
                {
                    var nameCell = table.Cell().Element(BodyCell);
                    if (withPages)
                        nameCell = nameCell.SectionLink(SectionOf(p));
                    nameCell.Column(cell =>
                    {
                        cell.Item().Text(p.Name);
                        var place = new[] { p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
                        var detail = string.Join(" · ", new[] { p.Program!.Name, string.Join("/", place) }
                            .Where(x => !string.IsNullOrWhiteSpace(x)));
                        cell.Item().Text(detail).FontSize(7.5f).FontColor(Muted);
                    });
                    table.Cell().Element(BodyCell).Text(StatusLabel(p.Status));
                    table.Cell().Element(BodyCell).AlignRight().Text(Number(p.Volunteers.Count));
                    table.Cell().Element(BodyCell).AlignRight().Text(Number(p.Updates.Count(u => model.InPeriod(u.Day))));
                    foreach (var national in nationals)
                    {
                        var value = NationalValue(p, national.Id);
                        table.Cell().Element(BodyCell).AlignRight()
                            .Text(value is { } informed ? Number(informed) : "–")
                            .FontColor(value is null ? Muted : Ink);
                    }
                    if (withPages)
                        table.Cell().Element(BodyCell).SectionLink(SectionOf(p)).AlignRight()
                            .Text(text => text.BeginPageNumberOfSection(SectionOf(p)));
                }

                // A nota vai no rodape da tabela: fora dela, podia sobrar sozinha numa pagina.
                var asOf = model.AsOf.ToString("dd/MM/yyyy");
                if (nationals.Count > 0)
                    table.Footer(footer => footer.Cell().ColumnSpan((uint)(4 + nationals.Count + (withPages ? 1 : 0)))
                        .PaddingTop(4)
                        .Text(anyMissing
                            ? $"Indicadores com os valores de {asOf}. – indicador não informado (diferente de zero)."
                            : $"Indicadores com os valores de {asOf}.")
                        .FontSize(7.5f).FontColor(Muted));
            });
        });
    }

    private static void ComposeProject(IContainer container, ReportModel model, Project p)
    {
        // Com periodo de referencia, so os registros e as tarefas concluidas dentro dele.
        // Linha do tempo pelo dia em que aconteceu (o mutirao de sabado registrado na segunda fica no sabado).
        var updates = p.Updates.Where(u => model.InPeriod(u.Day)).OrderBy(u => u.Day).ThenBy(u => u.CreatedAt).ToList();
        var doneTasks = p.Activities
            .Where(a => a.Status == ActivityStatus.Concluida && a.CompletedAt.HasValue && model.InPeriod(a.CompletedAt.Value))
            .OrderBy(a => a.CompletedAt)
            .ToList();

        container.EnsureSpace(160).Column(col =>
        {
            col.Spacing(8);

            // Identificacao
            col.Item().BorderBottom(2).BorderColor(Accent).PaddingBottom(4).Row(row =>
            {
                row.RelativeItem().Column(head =>
                {
                    head.Item().Text(p.Name).FontSize(12.5f).SemiBold();
                    head.Item().Text($"{p.Program!.Name} - {LocationLine(p)}").FontSize(8.5f).FontColor(Muted);
                    // Parceiros do programa logo abaixo do nome dele (so nome e papel).
                    var partners = model.PartnersLine(p.ProgramId);
                    if (partners != null)
                        head.Item().Text(text =>
                        {
                            text.Span("Parceiros: ").FontSize(8.5f).SemiBold().FontColor(Ink);
                            text.Span(partners).FontSize(8.5f).FontColor(Muted);
                        });
                });

                row.ConstantItem(120).AlignRight().Column(head =>
                {
                    head.Item().AlignRight().Text(StatusLabel(p.Status)).FontSize(9).SemiBold().FontColor(Accent);
                });
            });

            // Dados gerais
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(left =>
                {
                    left.Spacing(2);
                    left.Item().Element(c => Field(c, "Responsável", p.OwnerVolunteer?.Name ?? "Não definido"));
                    left.Item().Element(c => Field(c, "Período do projeto", PeriodLine(p)));
                    left.Item().Element(c => Field(c, "Comunidade ou família atendida", p.Beneficiaries ?? "-"));
                });

                row.ConstantItem(16);

                row.RelativeItem().Column(right =>
                {
                    right.Spacing(2);
                    right.Item().Element(c => Field(c, "Quem se beneficia", p.TargetAudience ?? "-"));
                    right.Item().Element(c => Field(c, "Localização", FullAddress(p)));
                });
            });

            if (!string.IsNullOrWhiteSpace(p.Objective))
                col.Item().Element(c => Paragraph(c, "Objetivo", p.Objective!));

            if (!string.IsNullOrWhiteSpace(p.Description))
                col.Item().Element(c => Paragraph(c, "Descrição", p.Description!));

            if (model.IncludeIndicators && p.Indicators.Count > 0)
                col.Item().Element(c => ComposeIndicators(c, model, p));

            if (model.IncludeVolunteers && p.Volunteers.Count > 0)
                col.Item().Element(c => ComposeVolunteers(c, model, p));

            if (model.IncludeTasks && doneTasks.Count > 0)
                col.Item().Element(c => ComposeTasks(c, model, doneTasks));

            if (model.IncludeUpdates && updates.Count > 0)
                col.Item().Element(c => ComposeUpdates(c, model, updates));
            else if (model.IncludeUpdates && model.HasPeriod)
                col.Item().Text("Nenhum registro de andamento no período.").FontSize(9).FontColor(Muted);

            if (!string.IsNullOrWhiteSpace(p.Notes))
                col.Item().Element(c => Paragraph(c, "Observações", p.Notes!));
        });
    }

    private static void ComposeIndicators(IContainer container, ReportModel model, Project p)
    {
        container.ShowEntire().Column(col =>
        {
            // Indicadores sao acumulados (120 pessoas desde o inicio). Com periodo, os valores sao os do fim dele (pelo
            // historico) e cada cartao diz quanto mudou no periodo; sempre, desde quando o numero vale (o informado em
            // marco nao vale "ate hoje").
            var asOf = model.AsOf.ToString("dd/MM/yyyy");
            col.Item().Text(text =>
            {
                text.Span("Indicadores").FontSize(10).SemiBold();
                if (model.HasPeriod)
                    text.Span($" · acumulados até {asOf}").FontSize(8.5f).FontColor(Muted);
            });

            // So os informados: indicador em branco (ainda nao apurado) nao vira zero no relatorio.
            var indicators = p.Indicators
                .Select(i => (Indicator: i, Figure: model.Figure(i)))
                .Where(x => x.Figure.Value.HasValue)
                .OrderBy(x => x.Indicator.NationalIndicatorId == null)
                .ThenBy(x => x.Indicator.CreatedAt)
                .ToList();
            if (indicators.Count == 0)
                col.Item().PaddingTop(4)
                    .Text(model.AsOf < TextHelpers.BrasiliaDay(model.GeneratedAt)
                        ? $"Nenhum indicador informado até {asOf}."
                        : "Nenhum indicador informado ainda.")
                    .FontSize(9).FontColor(Muted);
            foreach (var chunk in indicators.Chunk(4))
            {
                col.Item().PaddingTop(6).Row(row =>
                {
                    foreach (var (indicator, figure) in chunk)
                        row.RelativeItem().PaddingRight(6)
                            .Element(c => ValueCard(c, figure.Value!.Value, indicator.Unit, indicator.Name,
                                ChangeText(model, figure.Change),
                                figure.UpdatedAt is { } updated
                                    ? $"atualizado em {TextHelpers.BrasiliaDay(updated):dd/MM/yyyy}"
                                    : null));

                    for (var pad = chunk.Length; pad < 4; pad++)
                        row.RelativeItem();
                });
            }
        });
    }

    /// <summary>
    /// Cartao de indicador: valor e unidade em destaque, nome embaixo e as linhas de detalhe que houver (mudanca no
    /// periodo, data, cobertura). Usado no projeto e nos resultados do programa.
    /// </summary>
    private static void ValueCard(IContainer container, decimal value, string? unit, string name, params string?[] details)
    {
        container
            .Background(SoftBg)
            .BorderBottom(2)
            .BorderColor(Accent)
            .Padding(8)
            .Column(card =>
            {
                card.Item().AlignCenter().Text(text =>
                {
                    text.Span(Number(value)).FontSize(16).SemiBold().FontColor(Accent);
                    if (!string.IsNullOrWhiteSpace(unit))
                        text.Span($" {unit}").FontSize(9).FontColor(Muted);
                });
                card.Item().AlignCenter().Text(name).FontSize(7.5f).FontColor(Muted);
                foreach (var detail in details.Where(d => !string.IsNullOrWhiteSpace(d)))
                    card.Item().AlignCenter().Text(detail!).FontSize(6.5f).FontColor(Muted);
            });
    }

    /// <summary>Equipe do projeto; com horas lancadas (no periodo, quando ha), ganha a coluna Horas e o total.</summary>
    private static void ComposeVolunteers(IContainer container, ReportModel model, Project p)
    {
        var hours = model.Hours.GetValueOrDefault(p.Id) ?? new Dictionary<Guid, decimal>();
        var total = hours.Values.Sum();
        container.EnsureSpace(70).Column(col =>
        {
            col.Item().Text(text =>
            {
                text.Span($"Voluntários envolvidos ({p.Volunteers.Count})").FontSize(10).SemiBold();
                if (total > 0)
                    text.Span($" · {TextHelpers.Hours(total)} horas de voluntariado{(model.HasPeriod ? " no período" : "")}")
                        .FontSize(9).FontColor(Muted);
            });
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(3);
                    columns.RelativeColumn(3);
                    if (total > 0) columns.RelativeColumn(1);
                });

                // Sem contato (e-mail, telefone): o relatorio vai para parceiros e financiadores, que so precisam
                // saber quem fez parte e em que funcao.
                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Nome");
                    header.Cell().Element(HeadCell).Text("Função no projeto");
                    if (total > 0) header.Cell().Element(HeadCell).AlignRight().Text("Horas");
                });

                foreach (var v in p.Volunteers.OrderBy(v => v.Volunteer?.Name))
                {
                    table.Cell().Element(BodyCell).Text(v.Volunteer?.Name ?? "-");
                    table.Cell().Element(BodyCell).Text(v.RoleInProject ?? "-");
                    if (total > 0)
                        table.Cell().Element(BodyCell).AlignRight()
                            .Text(hours.TryGetValue(v.VolunteerId, out var h) ? TextHelpers.Hours(h) : "-");
                }
            });
        });
    }

    /// <summary>O que foi entregue: tarefas concluidas (no periodo, quando ha), com responsavel e data.</summary>
    private static void ComposeTasks(IContainer container, ReportModel model, List<Activity> tasks)
    {
        container.EnsureSpace(70).Column(col =>
        {
            var title = model.HasPeriod ? "Tarefas concluídas no período" : "Tarefas concluídas";
            col.Item().Text($"{title} ({tasks.Count})").FontSize(10).SemiBold();
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(5);
                    columns.RelativeColumn(3);
                    columns.ConstantColumn(72);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Tarefa");
                    header.Cell().Element(HeadCell).Text("Responsável");
                    header.Cell().Element(HeadCell).Text("Concluída em");
                });

                foreach (var task in tasks)
                {
                    table.Cell().Element(BodyCell).Text(task.Title);
                    table.Cell().Element(BodyCell).Text(task.AssignedVolunteer?.Name ?? "-");
                    table.Cell().Element(BodyCell).Text(TextHelpers.BrasiliaDay(task.CompletedAt!.Value).ToString("dd/MM/yyyy"));
                }
            });
        });
    }

    /// <summary>Historico cronologico do projeto: cada atualizacao com seu texto e as fotos anexadas a ela.</summary>
    private static void ComposeUpdates(IContainer container, ReportModel model, List<ProjectUpdate> updates)
    {
        container.EnsureSpace(70).Column(col =>
        {
            col.Item().Text(model.HasPeriod ? "Linha do tempo no período" : "Linha do tempo").FontSize(10).SemiBold();

            col.Item().PaddingTop(6).Column(inner =>
            {
                inner.Spacing(12);

                foreach (var update in updates)
                {
                    inner.Item().BorderLeft(2).BorderColor(Accent).PaddingLeft(8).Column(entry =>
                    {
                        entry.Spacing(3);

                        entry.Item().Text(ShortDate(update.Day)).FontSize(8.5f).SemiBold().FontColor(Accent);
                        entry.Item().Element(c => RichTextPdf.Compose(c, update.Text, 9));

                        if (model.IncludePhotos
                            && model.Photos.TryGetValue(update.Id, out var photos)
                            && photos.Count > 0)
                        {
                            // Grade de ate 3 por linha, celula sempre do mesmo tamanho (mesmo quando sobra
                            // so 1 foto na linha) - evita tanto foto perdida num espaco enorme quanto
                            // fotos espremidas quando ha muitas.
                            entry.Item().PaddingTop(2).Column(photoCol =>
                            {
                                photoCol.Spacing(4);

                                foreach (var chunk in photos.Chunk(3))
                                {
                                    photoCol.Item().Row(row =>
                                    {
                                        foreach (var photo in chunk)
                                        {
                                            row.RelativeItem().PaddingRight(6).Column(cell =>
                                            {
                                                cell.Item().Height(3f, Unit.Centimetre).Image(photo.Data).FitArea();

                                                if (!string.IsNullOrWhiteSpace(photo.Caption))
                                                    cell.Item().PaddingTop(1).Text(photo.Caption!).FontSize(7).FontColor(Muted);
                                            });
                                        }

                                        for (var pad = chunk.Length; pad < 3; pad++)
                                            row.RelativeItem();
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    // ---------- helpers de layout ----------

    private static void Field(IContainer container, string label, string value)
    {
        container.Text(text =>
        {
            text.Span($"{label}: ").FontSize(8.5f).SemiBold();
            text.Span(value).FontSize(8.5f).FontColor(Muted);
        });
    }

    private static void Paragraph(IContainer container, string label, string value)
    {
        container.EnsureSpace(50).Column(col =>
        {
            col.Item().Text(label).FontSize(10).SemiBold();
            col.Item().PaddingTop(2).Text(value).FontSize(9);
        });
    }

    private static IContainer HeadCell(IContainer container) =>
        container.Background(SoftBg).BorderBottom(1).BorderColor(Line)
            .PaddingVertical(4).PaddingHorizontal(5)
            .DefaultTextStyle(style => style.FontSize(8).SemiBold());

    private static IContainer BodyCell(IContainer container) =>
        container.BorderBottom(1).BorderColor(Line)
            .PaddingVertical(4).PaddingHorizontal(5)
            .DefaultTextStyle(style => style.FontSize(8.5f));

    // ---------- helpers de texto ----------

    public static string StatusLabel(ProjectStatus status) => status switch
    {
        ProjectStatus.Planejamento => "Planejamento",
        ProjectStatus.EmAndamento => "Em andamento",
        ProjectStatus.Pausado => "Pausado",
        ProjectStatus.Concluido => "Concluído",
        ProjectStatus.Cancelado => "Cancelado",
        _ => status.ToString()
    };

    private static string Number(decimal value) => TextHelpers.Number(value);

    /// <summary>Data curta sem depender de dados de cultura (o host roda com InvariantGlobalization).</summary>
    private static string ShortDate(DateOnly day) => $"{day.Day:00} {MonthAbbreviations[day.Month - 1]} {day.Year}";

    /// <summary>Do inicio ao dia em que foi concluido ou cancelado; em aberto (ou sem esse dia), ate a previsao.</summary>
    private static string PeriodLine(Project p)
    {
        var start = p.StartDate.ToString("dd/MM/yyyy");
        if (p.ClosedOn is { } closed) return $"{start} a {closed:dd/MM/yyyy}";
        var end = p.EndDateForecast is { } forecast ? $"{forecast:dd/MM/yyyy} (previsão)" : "sem previsão de término";
        return $"{start} a {end}";
    }

    private static string LocationLine(Project p)
    {
        var parts = new[] { p.District, p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
        var joined = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(joined) ? "localização não informada" : joined;
    }

    private static string FullAddress(Project p)
    {
        var parts = new[] { p.Address, p.District, p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
        var joined = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(joined) ? "-" : joined;
    }
}
