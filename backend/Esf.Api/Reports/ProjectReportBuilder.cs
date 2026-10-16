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

                page.Header().Element(c => ComposeHeader(c, model));
                page.Content().PaddingVertical(14).Element(c => ComposeContent(c, model));
                page.Footer().Element(c => ComposeFooter(c, model));
            });
        }).GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, ReportModel model)
    {
        container
            .BorderBottom(1)
            .BorderColor(Line)
            .PaddingBottom(8)
            .Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text(model.Organization.Name).FontSize(14).SemiBold();
                    col.Item().Text("Relatorio de projetos e resultados").FontSize(9).FontColor(Muted);
                });

                row.ConstantItem(180).AlignRight().Column(col =>
                {
                    col.Item().AlignRight().Text($"Emitido em {model.GeneratedAt.ToLocalTime():dd/MM/yyyy HH:mm}")
                        .FontSize(8).FontColor(Muted);
                    col.Item().AlignRight().Text($"Por {model.GeneratedBy}").FontSize(8).FontColor(Muted);
                    col.Item().AlignRight().Text($"{model.Projects.Count} projeto(s)").FontSize(8).FontColor(Muted);
                });
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
                    text.Span("Pagina ").FontSize(7.5f).FontColor(Muted);
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

    private static void ComposeContent(IContainer container, ReportModel model)
    {
        container.Column(col =>
        {
            col.Spacing(16);

            if (!string.IsNullOrWhiteSpace(model.Note))
            {
                col.Item().Background(SoftBg).Padding(10).Column(note =>
                {
                    note.Item().Text("Sobre este relatorio").FontSize(9).SemiBold();
                    note.Item().PaddingTop(2).Text(model.Note!).FontSize(9).FontColor(Muted);
                });
            }

            if (model.Projects.Count > 1)
                col.Item().Element(c => ComposeSummary(c, model));

            foreach (var project in model.Projects)
                col.Item().Element(c => ComposeProject(c, model, project));
        });
    }

    private static void ComposeSummary(IContainer container, ReportModel model)
    {
        container.Column(col =>
        {
            col.Item().Text("Resumo dos projetos").FontSize(11).SemiBold();
            col.Item().PaddingTop(6).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(4);
                    columns.RelativeColumn(2);
                    columns.ConstantColumn(72);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Projeto");
                    header.Cell().Element(HeadCell).Text("Programa");
                    header.Cell().Element(HeadCell).Text("Status");
                });

                foreach (var p in model.Projects)
                {
                    table.Cell().Element(BodyCell).Text(p.Name);
                    table.Cell().Element(BodyCell).Text(p.Program!.Name);
                    table.Cell().Element(BodyCell).Text(StatusLabel(p.Status));
                }
            });
        });
    }

    private static void ComposeProject(IContainer container, ReportModel model, Project p)
    {
        container.Column(col =>
        {
            col.Spacing(8);

            // Identificacao
            col.Item().BorderBottom(2).BorderColor(Accent).PaddingBottom(4).Row(row =>
            {
                row.RelativeItem().Column(head =>
                {
                    head.Item().Text(p.Name).FontSize(12.5f).SemiBold();
                    head.Item().Text($"{p.Program!.Name} - {LocationLine(p)}").FontSize(8.5f).FontColor(Muted);
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
                    left.Item().Element(c => Field(c, "Responsavel", p.OwnerVolunteer?.Name ?? "Nao definido"));
                    left.Item().Element(c => Field(c, "Periodo", PeriodLine(p)));
                    left.Item().Element(c => Field(c, "Comunidade/beneficiarios", p.Beneficiaries ?? "-"));
                });

                row.ConstantItem(16);

                row.RelativeItem().Column(right =>
                {
                    right.Spacing(2);
                    right.Item().Element(c => Field(c, "Publico beneficiado", p.TargetAudience ?? "-"));
                    right.Item().Element(c => Field(c, "Localizacao", FullAddress(p)));
                });
            });

            if (!string.IsNullOrWhiteSpace(p.Description))
                col.Item().Element(c => Paragraph(c, "Descricao", p.Description!));

            if (model.IncludeIndicators && p.Indicators.Count > 0)
                col.Item().Element(c => ComposeIndicators(c, p));

            if (model.IncludeVolunteers && p.Volunteers.Count > 0)
                col.Item().Element(c => ComposeVolunteers(c, p));

            if (model.IncludeUpdates && p.Updates.Count > 0)
                col.Item().Element(c => ComposeUpdates(c, model, p));

            if (!string.IsNullOrWhiteSpace(p.Notes))
                col.Item().Element(c => Paragraph(c, "Observacoes", p.Notes!));
        });
    }

    private static void ComposeIndicators(IContainer container, Project p)
    {
        container.Column(col =>
        {
            col.Item().Text("Indicadores").FontSize(10).SemiBold();

            var indicators = p.Indicators.OrderBy(i => i.CreatedAt).ToList();
            foreach (var chunk in indicators.Chunk(4))
            {
                col.Item().PaddingTop(6).Row(row =>
                {
                    foreach (var indicator in chunk)
                        row.RelativeItem().PaddingRight(6).Element(c => IndicatorCard(c, indicator));

                    for (var pad = chunk.Length; pad < 4; pad++)
                        row.RelativeItem();
                });
            }
        });
    }

    private static void IndicatorCard(IContainer container, Indicator i)
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
                    text.Span(Number(i.Value)).FontSize(16).SemiBold().FontColor(Accent);
                    if (!string.IsNullOrWhiteSpace(i.Unit))
                        text.Span($" {i.Unit}").FontSize(9).FontColor(Muted);
                });
                card.Item().AlignCenter().Text(i.Name).FontSize(7.5f).FontColor(Muted);
            });
    }

    private static void ComposeVolunteers(IContainer container, Project p)
    {
        container.Column(col =>
        {
            col.Item().Text($"Voluntarios envolvidos ({p.Volunteers.Count})").FontSize(10).SemiBold();
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(3);
                    columns.RelativeColumn(3);
                    columns.RelativeColumn(3);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Nome");
                    header.Cell().Element(HeadCell).Text("Papel no projeto");
                    header.Cell().Element(HeadCell).Text("Contato");
                });

                foreach (var v in p.Volunteers.OrderBy(v => v.Volunteer?.Name))
                {
                    table.Cell().Element(BodyCell).Text(v.Volunteer?.Name ?? "-");
                    table.Cell().Element(BodyCell).Text(v.RoleInProject ?? "-");
                    table.Cell().Element(BodyCell).Text(v.Volunteer?.Email ?? v.Volunteer?.Phone ?? "-");
                }
            });
        });
    }

    /// <summary>Historico cronologico do projeto: cada atualizacao com seu texto e as fotos anexadas a ela.</summary>
    private static void ComposeUpdates(IContainer container, ReportModel model, Project p)
    {
        container.Column(col =>
        {
            col.Item().Text("Linha do tempo").FontSize(10).SemiBold();

            var updates = p.Updates.OrderBy(u => u.CreatedAt).ToList();

            col.Item().PaddingTop(6).Column(inner =>
            {
                inner.Spacing(12);

                foreach (var update in updates)
                {
                    inner.Item().BorderLeft(2).BorderColor(Accent).PaddingLeft(8).Column(entry =>
                    {
                        entry.Spacing(3);

                        entry.Item().Text(ShortDate(update.CreatedAt)).FontSize(8.5f).SemiBold().FontColor(Accent);
                        entry.Item().Text(update.Text).FontSize(9);

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
        container.Column(col =>
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
        ProjectStatus.Concluido => "Concluido",
        ProjectStatus.Cancelado => "Cancelado",
        _ => status.ToString()
    };

    private static string Number(decimal value) =>
        value == Math.Truncate(value) ? ((long)value).ToString("N0") : value.ToString("N2");

    /// <summary>Data curta sem depender de dados de cultura (o host roda com InvariantGlobalization).</summary>
    private static string ShortDate(DateTime value)
    {
        var local = value.ToLocalTime();
        return $"{local.Day:00} {MonthAbbreviations[local.Month - 1]} {local.Year}";
    }

    private static string PeriodLine(Project p)
    {
        var start = p.StartDate.ToString("dd/MM/yyyy");
        var end = p.EndDateForecast?.ToString("dd/MM/yyyy") ?? "sem previsao";
        return $"{start} a {end}";
    }

    private static string LocationLine(Project p)
    {
        var parts = new[] { p.District, p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
        var joined = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(joined) ? "localizacao nao informada" : joined;
    }

    private static string FullAddress(Project p)
    {
        var parts = new[] { p.Address, p.District, p.City, p.State }.Where(x => !string.IsNullOrWhiteSpace(x));
        var joined = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(joined) ? "-" : joined;
    }
}
