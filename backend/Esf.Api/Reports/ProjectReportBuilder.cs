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
        var columnCount = (uint)(4 + nationals.Count + (withPages ? 1 : 0));
        // Com mais de um programa, uma linha-titulo por programa (os projetos ja vem em ordem de programa).
        var grouped = model.Programs.Count > 1;

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

                Guid? currentProgram = null;
                foreach (var p in model.Projects)
                {
                    if (grouped && p.ProgramId != currentProgram)
                    {
                        currentProgram = p.ProgramId;
                        table.Cell().ColumnSpan(columnCount).BorderBottom(1).BorderColor(Line)
                            .PaddingTop(8).PaddingBottom(3).PaddingHorizontal(5)
                            .Text(p.Program!.Name).FontSize(8.5f).SemiBold().FontColor(Accent);
                    }

                    var nameCell = table.Cell().Element(BodyCell);
                    if (withPages)
                        nameCell = nameCell.SectionLink(SectionOf(p));
                    nameCell.Column(cell =>
                    {
                        cell.Item().Text(p.Name);
                        // O programa ja esta no titulo do grupo (ou do relatorio): embaixo, so a cidade.
                        var place = string.Join("/", new[] { p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x)));
                        if (place.Length > 0)
                            cell.Item().Text(place).FontSize(7.5f).FontColor(Muted);
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
                    table.Footer(footer => footer.Cell().ColumnSpan(columnCount)
                        .PaddingTop(4)
                        .Text(anyMissing
                            ? $"Indicadores com os valores de {asOf}. – indicador não informado (diferente de zero)."
                            : $"Indicadores com os valores de {asOf}.")
                        .FontSize(7.5f).FontColor(Muted));
            });
        });
    }

    /// <summary>Quantas tarefas em aberto entram em "Próximas etapas".</summary>
    private const int MaxNextSteps = 5;

    /// <summary>
    /// Capitulo do projeto, na ordem em que o parceiro le a historia: o que e (identificacao, objetivo, descricao), o
    /// que rendeu (indicadores), o que aconteceu (linha do tempo com as fotos), o que foi entregue e o que vem (tarefas)
    /// e quem fez (equipe). Campo vazio nao aparece.
    /// </summary>
    private static void ComposeProject(IContainer container, ReportModel model, Project p)
    {
        // Com periodo de referencia, so os registros e as tarefas concluidas dentro dele.
        // Linha do tempo pelo dia em que aconteceu (o mutirao de sabado registrado na segunda fica no sabado).
        var updates = p.Updates.Where(u => model.InPeriod(u.Day)).OrderBy(u => u.Day).ThenBy(u => u.CreatedAt).ToList();
        var doneTasks = p.Activities
            .Where(a => a.Status == ActivityStatus.Concluida && a.CompletedAt.HasValue && model.InPeriod(a.CompletedAt.Value))
            .OrderBy(a => a.CompletedAt)
            .ToList();
        // O que vem: as tarefas em aberto de quem ainda nao terminou, pelo prazo (sem prazo por ultimo).
        var nextSteps = p.Status is ProjectStatus.Concluido or ProjectStatus.Cancelado
            ? new List<Activity>()
            : p.Activities
                .Where(a => a.Status != ActivityStatus.Concluida)
                .OrderBy(a => a.DueDate == null)
                .ThenBy(a => a.DueDate)
                .ThenBy(a => a.CreatedAt)
                .Take(MaxNextSteps)
                .ToList();

        container.EnsureSpace(160).Column(col =>
        {
            col.Spacing(8);

            // Identificacao: nome, programa (a localizacao fica so no campo dela) e parceiros do programa.
            col.Item().BorderBottom(2).BorderColor(Accent).PaddingBottom(4).Row(row =>
            {
                row.RelativeItem().Column(head =>
                {
                    head.Item().Text(p.Name).FontSize(12.5f).SemiBold();
                    head.Item().Text(p.Program!.Name).FontSize(8.5f).FontColor(Muted);
                    // Parceiros do programa logo abaixo do nome dele (so nome e papel).
                    var partners = model.PartnersLine(p.ProgramId);
                    if (partners != null)
                        head.Item().Text(text =>
                        {
                            text.Span("Parceiros: ").FontSize(8.5f).SemiBold().FontColor(Muted);
                            text.Span(partners).FontSize(8.5f).FontColor(Ink);
                        });
                });

                row.ConstantItem(120).AlignRight().Column(head =>
                {
                    head.Item().AlignRight().Text(StatusLabel(p.Status)).FontSize(9).SemiBold().FontColor(Accent);
                });
            });

            col.Item().Element(c => ComposeFields(c, p));

            if (!string.IsNullOrWhiteSpace(p.Objective))
                col.Item().Element(c => Paragraph(c, "Objetivo", p.Objective!));

            if (!string.IsNullOrWhiteSpace(p.Description))
                col.Item().Element(c => Paragraph(c, "Descrição", p.Description!));

            if (model.IncludeIndicators && p.Indicators.Count > 0)
                col.Item().Element(c => ComposeIndicators(c, model, p));

            if (model.IncludeUpdates && updates.Count > 0)
                col.Item().Element(c => ComposeUpdates(c, model, updates));
            else if (model.IncludeUpdates && model.HasPeriod)
                col.Item().Text("Nenhum registro de andamento no período.").FontSize(9).FontColor(Muted);

            if (model.IncludeTasks && doneTasks.Count > 0)
                col.Item().Element(c => ComposeTasks(c, model, doneTasks));

            if (model.IncludeTasks && nextSteps.Count > 0)
                col.Item().Element(c => ComposeNextSteps(c, nextSteps));

            if (model.IncludeVolunteers && p.Volunteers.Count > 0)
                col.Item().Element(c => ComposeVolunteers(c, model, p));

            if (!string.IsNullOrWhiteSpace(p.Notes))
                col.Item().Element(c => Paragraph(c, "Observações", p.Notes!));
        });
    }

    /// <summary>Dados do projeto em duas colunas, rotulo pequeno em cima e valor embaixo; o que esta vazio nao sai.</summary>
    private static void ComposeFields(IContainer container, Project p)
    {
        var fields = new List<(string Label, string? Value)>
            {
                ("Responsável", p.OwnerVolunteer?.Name),
                ("Período do projeto", PeriodLine(p)),
                ("Comunidade ou família atendida", p.Beneficiaries),
                ("Quem se beneficia", p.TargetAudience),
                ("Localização", FullAddress(p))
            }
            .Where(f => !string.IsNullOrWhiteSpace(f.Value))
            .ToList();

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.RelativeColumn();
            });

            foreach (var (label, value) in fields)
                table.Cell().PaddingBottom(5).PaddingRight(12).Element(c => Field(c, label, value!.Trim()));
        });
    }

    /// <summary>O que vem: ate 5 tarefas em aberto, com o prazo (sem responsavel: o parceiro quer o que, nao quem).</summary>
    private static void ComposeNextSteps(IContainer container, List<Activity> tasks)
    {
        container.EnsureSpace(60).Column(col =>
        {
            col.Item().Text("Próximas etapas").FontSize(10).SemiBold();
            col.Item().PaddingTop(4).Column(list =>
            {
                list.Spacing(3);
                foreach (var task in tasks)
                    list.Item().Row(row =>
                    {
                        row.ConstantItem(12).Text("•").FontColor(Accent);
                        row.RelativeItem().Text(text =>
                        {
                            text.Span(task.Title);
                            if (task.DueDate is { } due)
                                text.Span($" · até {due:dd/MM/yyyy}").FontSize(8.5f).FontColor(Muted);
                        });
                    });
            });
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

    /// <summary>Largura util de uma entrada da linha do tempo (A4 sem as margens, a borda e o recuo), em pontos.</summary>
    private const float TimelineWidth = 595.3f - 2 * 45.35f - 10;

    /// <summary>Altura que a pagina tem para o conteudo (sem margens, cabecalho e rodape), com folga.</summary>
    private const float PageContentHeight = 620;

    /// <summary>Espaco entre as fotos da grade.</summary>
    private const float PhotoGap = 6;

    /// <summary>
    /// Historico cronologico do projeto: cada registro com seu texto e as fotos anexadas a ele. A data, o texto e as
    /// fotos ficam juntos quando cabem numa pagina (antes, as fotos iam para a pagina seguinte e o texto ficava, com
    /// meia pagina em branco no meio; ou a data ficava sozinha no pe da pagina).
    /// </summary>
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
                    var photos = model.IncludePhotos && model.Photos.TryGetValue(update.Id, out var list) ? list : new List<ReportPhoto>();
                    var keepTogether = Math.Min(EstimatedHeight(update.Text, photos), PageContentHeight);

                    inner.Item().EnsureSpace((int)keepTogether).BorderLeft(2).BorderColor(Accent).PaddingLeft(8).Column(entry =>
                    {
                        entry.Spacing(3);

                        entry.Item().Text(ShortDate(update.Day)).FontSize(8.5f).SemiBold().FontColor(Accent);
                        entry.Item().Element(c => RichTextPdf.Compose(c, update.Text, 9));

                        if (photos.Count > 0)
                            entry.Item().PaddingTop(3).Element(c => ComposePhotos(c, photos));
                    });
                }
            });
        });
    }

    /// <summary>
    /// Grade das fotos de um registro, pelo tamanho conforme a quantidade: uma foto larga (60% da linha), duas lado a
    /// lado, tres numa linha, quatro em 2 x 2. Todas no mesmo formato (4:3, cortadas no ReportImageProcessor).
    /// </summary>
    private static void ComposePhotos(IContainer container, List<ReportPhoto> photos)
    {
        var perRow = photos.Count switch { 1 => 1, 3 => 3, _ => 2 };
        container.Column(grid =>
        {
            grid.Spacing(PhotoGap);
            foreach (var chunk in photos.Chunk(perRow))
            {
                grid.Item().Row(row =>
                {
                    row.Spacing(PhotoGap);
                    foreach (var photo in chunk)
                        row.RelativeItem(photos.Count == 1 ? 3 : 1).Column(cell =>
                        {
                            cell.Item().AspectRatio(4f / 3f).Image(photo.Data).FitArea();
                            if (!string.IsNullOrWhiteSpace(photo.Caption))
                                cell.Item().PaddingTop(1).Text(photo.Caption!).FontSize(7.5f).FontColor(Muted);
                        });

                    // Uma foto so ocupa 60% da linha; a ultima linha incompleta mantem o tamanho das de cima.
                    if (photos.Count == 1)
                        row.RelativeItem(2);
                    for (var pad = chunk.Length; pad < perRow; pad++)
                        row.RelativeItem();
                });
            }
        });
    }

    /// <summary>
    /// Altura aproximada de um registro (data, texto e fotos), em pontos, para manter os tres juntos: o texto conta
    /// ~100 caracteres por linha e uma linha a mais por paragrafo; as fotos, a altura exata da grade.
    /// </summary>
    private static float EstimatedHeight(string html, List<ReportPhoto> photos)
    {
        const float lineHeight = 12.5f;
        var paragraphs = Math.Max(1, System.Text.RegularExpressions.Regex.Matches(html, "<(p|li)[ >]").Count);
        var text = System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " ");
        var lines = paragraphs + (int)Math.Ceiling(text.Trim().Length / 100f);
        var height = 16 + lines * lineHeight;
        if (photos.Count == 0) return Math.Min(height, 16 + 3 * lineHeight);

        var perRow = photos.Count switch { 1 => 1, 3 => 3, _ => 2 };
        var width = photos.Count == 1
            ? TimelineWidth * 0.6f
            : (TimelineWidth - (perRow - 1) * PhotoGap) / perRow;
        var rows = (int)Math.Ceiling(photos.Count / (float)perRow);
        var caption = photos.Any(p => !string.IsNullOrWhiteSpace(p.Caption)) ? 12 : 0;
        return height + 6 + rows * (width * 3 / 4 + caption) + (rows - 1) * PhotoGap;
    }

    // ---------- helpers de layout ----------

    /// <summary>Rotulo pequeno e cinza em cima, valor escuro embaixo: o olho vai para a informacao, nao para o rotulo.</summary>
    private static void Field(IContainer container, string label, string value)
    {
        container.Column(field =>
        {
            field.Item().Text(label).FontSize(7.5f).FontColor(Muted);
            field.Item().Text(value).FontSize(9);
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

    /// <summary>Celula de tabela; ShowEntire: a linha nao se divide entre duas paginas (nome numa, cidade na outra).</summary>
    private static IContainer BodyCell(IContainer container) =>
        container.ShowEntire().BorderBottom(1).BorderColor(Line)
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

    /// <summary>Endereco, bairro, cidade e estado; null quando nada foi informado (o campo nao sai).</summary>
    private static string? FullAddress(Project p)
    {
        var parts = new[] { p.Address, p.District, p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
        var joined = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(joined) ? null : joined;
    }
}
