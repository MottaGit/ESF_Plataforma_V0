using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Esf.Api.Reports;

/// <summary>
/// Relatorio consolidado de projetos em PDF, com aparencia adequada para
/// apresentar a parceiros e para prestacao de contas.
/// </summary>
public static class ProjectReportBuilder
{
    private const string Ink = "#1B2028";
    private const string Muted = "#667085";
    private const string Line = "#DDE1E6";
    private const string SoftBg = "#F4F6F8";
    private const string Accent = "#10564A";

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
                row.RelativeItem().Text(model.Organization.Name + " - documento gerado pela plataforma de gestao de projetos")
                    .FontSize(7.5f).FontColor(Muted);

                row.ConstantItem(70).AlignRight().Text(text =>
                {
                    text.Span("Pagina ").FontSize(7.5f).FontColor(Muted);
                    text.CurrentPageNumber().FontSize(7.5f).FontColor(Muted);
                    text.Span(" de ").FontSize(7.5f).FontColor(Muted);
                    text.TotalPages().FontSize(7.5f).FontColor(Muted);
                });
            });
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
                    columns.ConstantColumn(58);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Projeto");
                    header.Cell().Element(HeadCell).Text("Programa");
                    header.Cell().Element(HeadCell).Text("Status");
                    header.Cell().Element(HeadCell).AlignRight().Text("Progresso");
                });

                foreach (var p in model.Projects)
                {
                    table.Cell().Element(BodyCell).Text(p.Name);
                    table.Cell().Element(BodyCell).Text(p.Program!.Name);
                    table.Cell().Element(BodyCell).Text(StatusLabel(p.Status));
                    table.Cell().Element(BodyCell).AlignRight().Text($"{p.Progress}%");
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
                    head.Item().AlignRight().Text($"Progresso {p.Progress}%").FontSize(8.5f).FontColor(Muted);
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
                    right.Item().Element(c => Field(c, "Coordenadas", Coordinates(p)));
                });
            });

            if (!string.IsNullOrWhiteSpace(p.Description))
                col.Item().Element(c => Paragraph(c, "Descricao", p.Description!));

            if (!string.IsNullOrWhiteSpace(p.Objective))
                col.Item().Element(c => Paragraph(c, "Objetivo", p.Objective!));

            if (model.IncludeIndicators && p.Indicators.Count > 0)
                col.Item().Element(c => ComposeIndicators(c, p));

            if (model.IncludeActivities && p.Activities.Count > 0)
                col.Item().Element(c => ComposeActivities(c, p));

            if (model.IncludeVolunteers && p.Volunteers.Count > 0)
                col.Item().Element(c => ComposeVolunteers(c, p));

            if (model.IncludePhotos
                && model.Photos.TryGetValue(p.Id, out var photos)
                && photos.Count > 0)
                col.Item().Element(c => ComposePhotos(c, photos));

            if (model.IncludeUpdates && p.Updates.Count > 0)
                col.Item().Element(c => ComposeUpdates(c, p));

            if (!string.IsNullOrWhiteSpace(p.Notes))
                col.Item().Element(c => Paragraph(c, "Observacoes", p.Notes!));
        });
    }

    private static void ComposeIndicators(IContainer container, Project p)
    {
        container.Column(col =>
        {
            col.Item().Text("Indicadores").FontSize(10).SemiBold();
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(4);
                    columns.ConstantColumn(70);
                    columns.ConstantColumn(70);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Indicador");
                    header.Cell().Element(HeadCell).Text("Unidade");
                    header.Cell().Element(HeadCell).AlignRight().Text("Valor");
                });

                foreach (var i in p.Indicators.OrderBy(i => i.CreatedAt))
                {
                    table.Cell().Element(BodyCell).Text(i.Name);
                    table.Cell().Element(BodyCell).Text(i.Unit ?? "-");
                    table.Cell().Element(BodyCell).AlignRight().Text(Number(i.Value));
                }
            });
        });
    }

    private static void ComposeActivities(IContainer container, Project p)
    {
        container.Column(col =>
        {
            var done = p.Activities.Count(a => a.Status == ActivityStatus.Concluida);

            col.Item().Text($"Atividades ({done} de {p.Activities.Count} concluidas)").FontSize(10).SemiBold();
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(5);
                    columns.RelativeColumn(2);
                    columns.ConstantColumn(64);
                    columns.ConstantColumn(52);
                    columns.ConstantColumn(58);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeadCell).Text("Atividade");
                    header.Cell().Element(HeadCell).Text("Responsavel");
                    header.Cell().Element(HeadCell).Text("Status");
                    header.Cell().Element(HeadCell).Text("Prioridade");
                    header.Cell().Element(HeadCell).AlignRight().Text("Prazo");
                });

                foreach (var a in p.Activities.OrderBy(a => a.Status).ThenBy(a => a.DueDate ?? DateOnly.MaxValue))
                {
                    table.Cell().Element(BodyCell).Text(a.Title);
                    table.Cell().Element(BodyCell).Text(a.AssignedVolunteer?.Name ?? "-");
                    table.Cell().Element(BodyCell).Text(ActivityStatusLabel(a.Status));
                    table.Cell().Element(BodyCell).Text(a.Priority.ToString());
                    table.Cell().Element(BodyCell).AlignRight().Text(a.DueDate?.ToString("dd/MM/yyyy") ?? "-");
                }
            });
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

    private static void ComposeUpdates(IContainer container, Project p)
    {
        container.Column(col =>
        {
            col.Item().Text("Atualizações").FontSize(10).SemiBold();

            col.Item().PaddingTop(4).Column(inner =>
            {
                inner.Spacing(6);

                foreach (var u in p.Updates.OrderByDescending(u => u.CreatedAt))
                {
                    inner.Item().Column(entry =>
                    {
                        entry.Item().Text(u.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm"))
                            .FontSize(8).SemiBold().FontColor(Muted);
                        entry.Item().PaddingTop(1).Text(u.Text).FontSize(9);
                    });
                }
            });
        });
    }

    private static void ComposePhotos(IContainer container, List<ReportPhoto> photos)
    {
        container.Column(col =>
        {
            col.Item().Text("Registro fotografico").FontSize(10).SemiBold();

            foreach (var pair in photos.Chunk(2))
            {
                col.Item().PaddingTop(6).Row(row =>
                {
                    foreach (var photo in pair)
                    {
                        row.RelativeItem().PaddingRight(6).Column(cell =>
                        {
                            cell.Item().Height(4.6f, Unit.Centimetre).Image(photo.Data);
                            cell.Item().PaddingTop(2).Text(photo.Caption).FontSize(7.5f).FontColor(Muted);
                        });
                    }

                    if (pair.Length == 1) row.RelativeItem();
                });
            }
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

    private static string ActivityStatusLabel(ActivityStatus status) => status switch
    {
        ActivityStatus.AFazer => "A fazer",
        ActivityStatus.EmAndamento => "Em andamento",
        ActivityStatus.Concluida => "Concluida",
        _ => status.ToString()
    };

    private static string Number(decimal value) =>
        value == Math.Truncate(value) ? ((long)value).ToString("N0") : value.ToString("N2");

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

    private static string Coordinates(Project p) =>
        p.Latitude.HasValue && p.Longitude.HasValue
            ? $"{p.Latitude.Value:0.#####}, {p.Longitude.Value:0.#####}"
            : "-";
}
