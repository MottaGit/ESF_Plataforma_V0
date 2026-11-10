using ClosedXML.Excel;
using Esf.Api.Common;
using static Esf.Api.Spreadsheets.SpreadsheetLayout;

namespace Esf.Api.Spreadsheets;

/// <summary>O que vai na planilha: exportacao (com as linhas) ou modelo vazio de importacao.</summary>
public sealed class SpreadsheetContent
{
    /// <summary>false: modelo vazio de importacao (sem linhas e sem as colunas so de exportacao).</summary>
    public required bool Export { get; init; }
    public required bool IncludeProjects { get; init; }
    public required bool IncludeVolunteers { get; init; }
    public required string Nucleo { get; init; }
    /// <summary>Hora local da geracao.</summary>
    public required DateTime GeneratedAt { get; init; }
    public string? GeneratedBy { get; init; }
    public required IReadOnlyList<NationalColumn> Nationals { get; init; }
    public int Slots { get; init; } = SpecificSlots;

    /// <summary>Todos os programas do nucleo, ativos primeiro (listas suspensas e aba Programas).</summary>
    public required IReadOnlyList<ProgramSheetRow> Programs { get; init; }
    public IReadOnlyList<ProjectSheetRow> Projects { get; init; } = Array.Empty<ProjectSheetRow>();
    public IReadOnlyList<VolunteerSheetRow> Volunteers { get; init; } = Array.Empty<VolunteerSheetRow>();
    public required IReadOnlyList<string> VolunteerNames { get; init; }
    public required IReadOnlyList<string> SpecificIndicators { get; init; }
}

/// <summary>
/// Monta a planilha (.xlsx): aba Instrucoes (escrita para ser seguida ao pe da letra, por gente ou por uma IA), as abas
/// de dados com titulo colorido por tipo de coluna e comentario em cada titulo, e a aba oculta Listas (opcoes das
/// listas suspensas e a identificacao do arquivo, que a importacao confere).
/// </summary>
public static class SpreadsheetBuilder
{
    private const string Font = "Arial";
    private static readonly XLColor Navy = XLColor.FromHtml("#1F3864");
    private static readonly XLColor Green = XLColor.FromHtml("#375623");
    private static readonly XLColor TabData = XLColor.FromHtml("#2F75B5");
    private static readonly XLColor TabSummary = XLColor.FromHtml("#A6A6A6");

    /// <summary>Linhas com validacao (lista, data, numero) abaixo do titulo.</summary>
    private const int ValidatedRows = 1000;

    public static byte[] Build(SpreadsheetContent content)
    {
        using var workbook = new XLWorkbook();
        workbook.Style.Font.FontName = Font;
        workbook.Style.Font.FontSize = 10;

        var instructions = workbook.Worksheets.Add(InstructionsSheet);
        var programs = content.Export && content.IncludeProjects ? workbook.Worksheets.Add(ProgramsSheet) : null;
        var projects = content.IncludeProjects ? workbook.Worksheets.Add(ProjectsSheet) : null;
        var volunteers = content.IncludeVolunteers ? workbook.Worksheets.Add(VolunteersSheet) : null;
        var lists = Lists(workbook.Worksheets.Add(ListsSheet), content);

        if (programs is not null)
            DataSheet(programs, TabSummary, ProgramColumns, content.Programs.Where(p => p.Projects > 0).ToList(), 1);
        if (projects is not null)
        {
            var columns = ProjectColumns(content.Nationals, content.Slots, content.Export);
            DataSheet(projects, TabData, columns, content.Projects, 2);
            ProjectValidations(projects, columns, lists, content.Projects.Count);
        }
        if (volunteers is not null)
        {
            var columns = VolunteerColumns(content.Export);
            DataSheet(volunteers, TabData, columns, content.Volunteers, 1);
            VolunteerValidations(volunteers, columns, lists, content.Volunteers.Count);
        }
        Instructions.Write(instructions, content);

        instructions.SetTabActive();
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    // ---------- abas de dados ----------

    private static void HeaderStyle(IXLStyle style, ColumnKind kind)
    {
        style.Font.Bold = true;
        (style.Font.FontColor, style.Fill.BackgroundColor) = kind switch
        {
            ColumnKind.Required => (XLColor.White, Navy),
            ColumnKind.National => (Green, XLColor.FromHtml("#E2EFDA")),
            ColumnKind.ExportOnly => (XLColor.FromHtml("#595959"), XLColor.FromHtml("#E7E6E6")),
            _ => (Navy, XLColor.FromHtml("#D9E2F3"))
        };
    }

    private static void DataSheet<T>(IXLWorksheet sheet, XLColor tab, IReadOnlyList<SheetColumn<T>> columns,
        IReadOnlyList<T> rows, int frozenColumns)
    {
        sheet.SetTabColor(tab);
        for (var i = 0; i < columns.Count; i++)
        {
            var column = columns[i];
            var cell = sheet.Cell(1, i + 1);
            cell.Value = column.Name;
            HeaderStyle(cell.Style, column.Kind);
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.BottomBorderColor = XLColor.FromHtml("#8EA9DB");

            var note = $"{column.What}\n\n{column.Accepted}";
            if (column.Kind == ColumnKind.Required) note = "Obrigatória. " + note;
            var comment = cell.CreateComment();
            comment.Author = "Plataforma ESF";
            comment.AddText(note);
            // Caixa de uns 340 px de largura (largura em colunas) e altura em pontos pelo numero de linhas do texto.
            var lines = note.Split('\n').Sum(part => Math.Max(1, (int)Math.Ceiling(part.Length / 56.0)));
            comment.Style.Size.SetWidth(34);
            comment.Style.Size.SetHeight(lines * 11.5 + 8);

            var sheetColumn = sheet.Column(i + 1);
            sheetColumn.Width = column.Width;
            if (column.Format is not null) sheetColumn.Style.NumberFormat.Format = column.Format;
        }
        sheet.Row(1).Height = 32;

        for (var r = 0; r < rows.Count; r++)
            for (var i = 0; i < columns.Count; i++)
                sheet.Cell(r + 2, i + 1).Value = CellValue(columns[i].Value(rows[r]));

        sheet.SheetView.Freeze(1, frozenColumns);
        sheet.Range(1, 1, Math.Max(rows.Count, 1) + 1, columns.Count).SetAutoFilter();
    }

    private static XLCellValue CellValue(object? value) => value switch
    {
        null => Blank.Value,
        string text => text,
        DateOnly date => date.ToDateTime(TimeOnly.MinValue),
        decimal number => (double)number,
        int number => (double)number,
        _ => value.ToString() ?? ""
    };

    // ---------- aba Listas ----------

    /// <summary>Faixas da aba Listas usadas nas validacoes (sem a faixa quando a lista esta vazia).</summary>
    private sealed record ListRanges(IXLRange? Programs, IXLRange VolunteerStatuses, IXLRange Sectors, IXLRange ProjectStatuses,
        IXLRange States, IXLRange? Volunteers, IXLRange? Indicators);

    private static ListRanges Lists(IXLWorksheet sheet, SpreadsheetContent content)
    {
        IXLRange? Column(int index, string title, IReadOnlyList<string> values)
        {
            sheet.Cell(1, index).Value = title;
            sheet.Cell(1, index).Style.Font.Bold = true;
            for (var r = 0; r < values.Count; r++) sheet.Cell(r + 2, index).Value = values[r];
            sheet.Column(index).Width = 34;
            return values.Count == 0 ? null : sheet.Range(2, index, values.Count + 1, index);
        }

        var ranges = new ListRanges(
            Column(1, "Programas", content.Programs.Select(p => p.Name).ToList()),
            Column(2, "Situação do voluntário", VolunteerStatuses.Select(s => s.Label).ToList())!,
            Column(3, "Setores", Sectors.Select(s => s.Label).ToList())!,
            Column(4, "Situação do projeto", ProjectStatuses.Select(s => s.Label).ToList())!,
            Column(5, "Estados", States)!,
            Column(6, "Voluntários", content.VolunteerNames),
            Column(7, "Indicadores específicos", content.SpecificIndicators));

        // Identificacao do arquivo: a importacao procura estes titulos na linha 1 e le o valor logo abaixo.
        var identity = new (string Label, XLCellValue Value)[]
        {
            (FileKindLabel, FileKind), (VersionLabel, FormatVersion), (NucleoLabel, content.Nucleo)
        };
        for (var i = 0; i < identity.Length; i++)
        {
            sheet.Cell(1, 9 + i).Value = identity[i].Label;
            sheet.Cell(1, 9 + i).Style.Font.Bold = true;
            sheet.Cell(2, 9 + i).Value = identity[i].Value;
            sheet.Column(9 + i).Width = 40;
        }

        // Indicadores de cada programa, na ordem: quem preenche (uma IA, inclusive) repete igual nos projetos novos.
        sheet.Cell(1, 13).Value = "Indicadores por programa: programa";
        sheet.Cell(1, 14).Value = "Indicadores específicos, na ordem";
        sheet.Range(1, 13, 1, 14).Style.Font.Bold = true;
        for (var r = 0; r < content.Programs.Count; r++)
        {
            sheet.Cell(r + 2, 13).Value = content.Programs[r].Name;
            sheet.Cell(r + 2, 14).Value = string.Join("; ", content.Programs[r].Indicators);
        }
        sheet.Column(13).Width = 46;
        sheet.Column(14).Width = 60;

        sheet.Hide();
        return ranges;
    }

    // ---------- validacoes ----------

    private static IXLDataValidation Validation(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, string name, int rows)
    {
        var index = columns.ToList().FindIndex(c => c.Name == name) + 1;
        var validation = sheet.Range(2, index, Math.Max(ValidatedRows, rows + 500), index).CreateDataValidation();
        validation.IgnoreBlanks = true;
        validation.ShowErrorMessage = true;
        return validation;
    }

    private static void ListRule(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, string name, int rows,
        IXLRange? source, string error, bool warning = false)
    {
        if (source is null) return;
        var validation = Validation(sheet, columns, name, rows);
        validation.List(source, true);
        validation.ErrorStyle = warning ? XLErrorStyle.Warning : XLErrorStyle.Stop;
        validation.ErrorTitle = warning ? "Nome novo" : "Valor fora da lista";
        validation.ErrorMessage = error;
    }

    private static void DateRule(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, string name, int rows)
    {
        var validation = Validation(sheet, columns, name, rows);
        validation.Date.EqualOrGreaterThan(MinDate.ToDateTime(TimeOnly.MinValue));
        validation.ErrorTitle = "Data inválida";
        validation.ErrorMessage = "Digite uma data no formato dd/mm/aaaa (de 1990 em diante).";
    }

    private static void NumberRule(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, string name, int rows)
    {
        var validation = Validation(sheet, columns, name, rows);
        validation.Decimal.EqualOrGreaterThan(0);
        validation.ErrorTitle = "Número inválido";
        validation.ErrorMessage = "Digite um número, 0 ou mais. Deixe em branco se não foi informado.";
    }

    private static void ProjectValidations(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, ListRanges lists, int rows)
    {
        ListRule(sheet, columns, ProgramColumn, rows, lists.Programs,
            "Programa que ainda não existe: a importação vai criar. Confira se não é um nome já existente digitado de outro jeito.",
            warning: true);
        ListRule(sheet, columns, ProjectStatusColumn, rows, lists.ProjectStatuses,
            "Escolha: Planejamento, Em andamento, Pausado, Concluído ou Cancelado.");
        ListRule(sheet, columns, State, rows, lists.States, "Use a sigla do estado (UF).");
        ListRule(sheet, columns, Owner, rows, lists.Volunteers,
            "Esse nome não está entre os voluntários. Se for alguém novo, inclua na aba Voluntários.", warning: true);
        DateRule(sheet, columns, Start, rows);
        DateRule(sheet, columns, End, rows);
        foreach (var column in columns.Where(c => c.Kind == ColumnKind.National))
            NumberRule(sheet, columns, column.Name, rows);
        foreach (var column in columns.Where(c => c.Name.StartsWith(IndicatorPrefix + " ", StringComparison.Ordinal)))
            ListRule(sheet, columns, column.Name, rows, lists.Indicators,
                "Indicador novo: confira se não é um já usado, escrito de outro jeito.", warning: true);
        foreach (var column in columns.Where(c => c.Name.StartsWith(ValuePrefix + " ", StringComparison.Ordinal)))
            NumberRule(sheet, columns, column.Name, rows);
    }

    private static void VolunteerValidations(IXLWorksheet sheet, IReadOnlyList<SheetColumn> columns, ListRanges lists, int rows)
    {
        ListRule(sheet, columns, Sector, rows, lists.Sectors, "Escolha um setor da lista.");
        ListRule(sheet, columns, VolunteerStatusColumn, rows, lists.VolunteerStatuses,
            "Escolha: Ativo, Inativo, Ex-membro ou Afastado.");
        DateRule(sheet, columns, Joined, rows);
        DateRule(sheet, columns, Left, rows);
    }

    // ---------- aba Instrucoes ----------

    /// <summary>Escrita sequencial da aba Instrucoes: secoes, paragrafos, listas numeradas e tabelas (colunas A a F).</summary>
    private sealed class Instructions
    {
        private static readonly double[] Widths = { 24, 24, 12, 46, 52, 34 };

        private readonly IXLWorksheet _sheet;
        private int _row = 1;

        private Instructions(IXLWorksheet sheet)
        {
            _sheet = sheet;
            sheet.ShowGridLines = false;
            sheet.SetTabColor(Navy);
            for (var i = 0; i < Widths.Length; i++) sheet.Column(i + 1).Width = Widths[i];
        }

        private enum Look { Body, Label, Muted, Title, Section, Header }

        private IXLCell Put(int column, string text, Look look = Look.Body)
        {
            var cell = _sheet.Cell(_row, column);
            cell.Value = text;
            var style = cell.Style;
            style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
            style.Alignment.WrapText = true;
            switch (look)
            {
                case Look.Label:
                    style.Font.Bold = true;
                    break;
                case Look.Muted:
                    style.Font.Italic = true;
                    style.Font.FontColor = XLColor.FromHtml("#7F7F7F");
                    break;
                case Look.Title:
                    style.Font.Bold = true;
                    style.Font.FontSize = 14;
                    style.Font.FontColor = Navy;
                    style.Alignment.WrapText = false;
                    break;
                case Look.Section:
                    style.Font.Bold = true;
                    style.Font.FontSize = 11;
                    style.Font.FontColor = Navy;
                    style.Alignment.WrapText = false;
                    break;
                case Look.Header:
                    HeaderStyle(style, ColumnKind.Optional);
                    style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                    break;
            }
            return cell;
        }

        /// <summary>Mescla da coluna ate a F e devolve a largura resultante.</summary>
        private double Merge(int first, int last = 6)
        {
            if (last > first) _sheet.Range(_row, first, _row, last).Merge();
            return Widths[(first - 1)..last].Sum();
        }

        /// <summary>Altura da linha pelo texto mais longo (celula mesclada nao ajusta sozinha no Excel).</summary>
        private void Height(params (string Text, double Width)[] cells)
        {
            var lines = cells.Max(c => c.Text.Split('\n')
                .Sum(part => Math.Max(1, (int)Math.Ceiling(part.Length / Math.Max(1, Math.Floor(c.Width * 0.95))))));
            if (lines > 1) _sheet.Row(_row).Height = 13.5 * lines;
        }

        private void Title(string text, string subtitle)
        {
            Put(1, text, Look.Title);
            _sheet.Row(1).Height = 24;
            _row = 2;
            Paragraph(subtitle, Look.Muted);
            _row++;
        }

        private void Section(string text)
        {
            _row++;
            Put(1, text, Look.Section);
            _row++;
        }

        private void Paragraph(string text, Look look = Look.Body)
        {
            Put(1, text, look);
            Height((text, Merge(1)));
            _row++;
        }

        /// <summary>Rotulo na coluna A, texto em B:F.</summary>
        private void Pairs(IEnumerable<(string Label, string Text)> items)
        {
            foreach (var (label, text) in items)
            {
                Put(1, label, Look.Label);
                Put(2, text);
                Height((text, Merge(2)), (label, Widths[0]));
                _row++;
            }
        }

        private void Numbered(IEnumerable<string> items)
        {
            var number = 1;
            foreach (var text in items)
            {
                Put(1, $"{number++}.", Look.Label).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                Put(2, text);
                Height((text, Merge(2)));
                _row++;
            }
        }

        /// <summary>Tabela com titulo; com menos de 6 colunas, a ultima ocupa o resto da largura.</summary>
        private void Table(string[] headers, IEnumerable<string[]> rows)
        {
            void Line(string[] values, bool header)
            {
                var sizes = new List<(string, double)>();
                for (var i = 0; i < values.Length; i++)
                {
                    Put(i + 1, values[i], header ? Look.Header : i == 0 ? Look.Label : Look.Body);
                    var width = i == values.Length - 1 ? Merge(i + 1) : Widths[i];
                    sizes.Add((values[i], width));
                }
                if (!header) Height(sizes.ToArray());
                _row++;
            }

            Line(headers, true);
            foreach (var values in rows) Line(values, false);
        }

        /// <summary>"A", "A e B", "A, B e C".</summary>
        private static string Names(IReadOnlyList<string> names) =>
            names.Count <= 1 ? string.Join("", names) : $"{string.Join(", ", names.Take(names.Count - 1))} e {names[^1]}";

        public static void Write(IXLWorksheet sheet, SpreadsheetContent content) => new Instructions(sheet).WriteAll(content);

        private void WriteAll(SpreadsheetContent c)
        {
            var export = c.Export;
            var both = c.IncludeProjects && c.IncludeVolunteers;
            var nationals = c.Nationals.Select(n => n.Name).ToList();
            var people = c.Nationals.FirstOrDefault(n => SearchText.Fold(n.Name).Contains("pessoa"))?.Name;
            var whereToNote = both
                ? "em Observações (aba Projetos) ou em Outras informações relevantes (aba Voluntários)"
                : c.IncludeProjects ? "em Observações" : "em Outras informações relevantes";

            if (export)
            {
                Title($"Exportação de dados · {c.Nucleo}",
                    "Dados do núcleo na data abaixo. O mesmo arquivo pode ser completado e importado de volta: o que já existe "
                    + "na plataforma é ignorado.");
                var what = both
                    ? "Projetos (com o resumo dos programas) e voluntários"
                    : c.IncludeProjects ? "Projetos (com o resumo dos programas)" : "Voluntários";
                Pairs(new[]
                {
                    (NucleoLabel, c.Nucleo),
                    ("Exportado em", $"{c.GeneratedAt:dd/MM/yyyy} às {c.GeneratedAt:HH:mm}"),
                    ("Exportado por", c.GeneratedBy ?? "—"),
                    ("O que foi exportado", what),
                    (VersionLabel, FormatVersion.ToString())
                });
            }
            else
            {
                Title($"Modelo de importação · {c.Nucleo}",
                    "Modelo vazio para preencher (à mão ou com a ajuda de uma IA) e importar na plataforma, em Configurações › Planilhas.");
                Pairs(new[] { (NucleoLabel, c.Nucleo), ("Gerado em", $"{c.GeneratedAt:dd/MM/yyyy}"), (VersionLabel, FormatVersion.ToString()) });
            }

            Section("O que é este arquivo");
            Paragraph("Uma planilha da plataforma de gestão da ESF com programas, projetos e voluntários de um núcleo. O mesmo "
                      + "formato serve para exportar e para importar: na importação, a plataforma lê só as abas Projetos e "
                      + "Voluntários, mostra uma conferência (o que é novo, o que já existe e os erros de cada linha) e só grava "
                      + "depois da confirmação." + (export && c.IncludeProjects ? " A aba Programas é só um resumo para consulta." : ""));

            Section("Abas");
            var tabs = new List<(string Name, string What, string Read)> { (InstructionsSheet, "Estas orientações.", "Não é lida") };
            if (export && c.IncludeProjects)
                tabs.Add((ProgramsSheet, "Resumo: um programa por linha, com a situação, quantos projetos tem e os indicadores específicos.",
                    "Não é lida (os programas saem da aba Projetos)"));
            if (c.IncludeProjects)
                tabs.Add((ProjectsSheet, "Um projeto por linha, agrupados por programa, com os indicadores e a equipe.", "É lida"));
            if (c.IncludeVolunteers)
                tabs.Add((VolunteersSheet, "Uma pessoa por linha, com a situação e as datas de entrada e saída.", "É lida"));
            tabs.Add(($"{ListsSheet} (oculta)", "Opções das listas suspensas e a identificação do arquivo (tipo e versão do modelo).",
                "Identifica o arquivo: não mexa"));
            // Aba (A), O que tem (B:D), Na importacao (E:F).
            Put(1, "Aba", Look.Header);
            Put(2, "O que tem", Look.Header);
            Merge(2, 4);
            Put(5, "Na importação", Look.Header);
            Merge(5);
            _row++;
            foreach (var (name, what, read) in tabs)
            {
                Put(1, name, Look.Label);
                Put(2, what);
                var whatWidth = Merge(2, 4);
                Put(5, read);
                Height((what, whatWidth), (read, Merge(5)));
                _row++;
            }

            var sheetsToFill = both ? "as abas Projetos e Voluntários" : c.IncludeProjects ? "a aba Projetos" : "a aba Voluntários";
            Section("Regras gerais (siga ao pé da letra, à mão ou com uma IA)");
            Numbered(new[]
            {
                $"Preencha só {sheetsToFill}. Não crie, não renomeie, não apague e não reordene abas; não mexa na aba oculta "
                + "Listas (ela pode ser lida).",
                "A linha 1 de cada aba é o título das colunas: não altere, não crie e não apague colunas. Cada linha abaixo é um "
                + "registro: um projeto (aba Projetos) ou uma pessoa (aba Voluntários). Comece na linha 2, sem linhas em branco no "
                + "meio, sem células mescladas e sem usar cor ou comentário para dar informação.",
                "Colunas com * no título são obrigatórias. As outras podem ficar em branco.",
                "Não invente: use só o que a fonte diz ou o que dá para deduzir sem dúvida dela mesma (ex.: Porto Alegre → Estado "
                + "RS; \"família de 7 pessoas\" → 1 família e 7 pessoas). O resto fica em branco.",
                $"Na dúvida entre duas formas, fique com a mais cautelosa (deixar em branco) e escreva a dúvida {whereToNote}. A "
                + "conferência da importação mostra a linha para alguém decidir.",
                $"Se faltar um dado obrigatório, preencha o resto da linha, deixe o obrigatório em branco e escreva o que falta {whereToNote}.",
                "Número aproximado dado pela fonte (\"uns 400\") pode ser usado; anote \"valor aproximado\" em Observações.",
                "Datas no formato dd/mm/aaaa (ex.: 07/03/2024), como data do Excel ou como texto. Só mês e ano: início e entrada "
                + "usam o dia 1 (03/2024 → 01/03/2024); término e saída usam o último dia do mês (08/2021 → 31/08/2021). Só o mês "
                + "(\"terminou em maio\"): deduza o ano pelas outras datas da mesma informação (o término não vem antes do início) "
                + "e anote \"ano deduzido\" em Observações (só quando o ano não está escrito na mesma frase). Só o ano: deixe a "
                + "data em branco e anote o ano em Observações.",
                "Números: só o número, sem unidade e sem ponto de milhar (16000, não 16.000 nem 16 mil litros). Decimal com "
                + "vírgula ou ponto (10,57).",
                "Indicadores: em branco quer dizer \"não informado\" e não entra nas somas; 0 quer dizer zero. Só escreva 0 se a "
                + "fonte disser que foi zero.",
                "Valores de lista (Situação, Setor, Estado) escritos exatamente como no dicionário abaixo, com acento e maiúscula igual.",
                "Programas, pessoas e indicadores que já estão na plataforma aparecem nas listas suspensas das colunas Programa, "
                + "Responsável e Indicador (e na aba oculta Listas). Quando a informação for de um deles, escreva o nome exatamente "
                + "como na lista.",
                "Pessoas: a mesma pessoa tem o mesmo nome completo em todo lugar (aba Voluntários, Responsável e Equipe). Fonte com "
                + "só o primeiro nome: se a lista tiver uma única pessoa com esse nome, use o nome completo dela; se tiver mais de "
                + "uma ou nenhuma, use o nome completo que a própria fonte der em outra parte (\"a Marta\" e \"Marta Silva\" são a "
                + "mesma pessoa) ou, sem ele, escreva o nome como veio e anote a dúvida.",
                "Cada projeto e cada pessoa aparecem uma vez só. Não repita linhas.",
                "Não coloque dados que a planilha não pede: CPF, RG, endereço de voluntário, saúde, religião ou origem."
            });

            Section("Como a importação reconhece o que já existe");
            var recognition = new List<(string, string)>();
            if (c.IncludeVolunteers)
                recognition.Add(("Voluntário", "Pelo e-mail; sem e-mail, pelo nome completo. Quem já está na plataforma é ignorado "
                                               + "(a importação só cria, nunca altera o que existe)."));
            if (c.IncludeProjects)
            {
                recognition.Add(("Projeto", "Pelo nome do projeto dentro do programa. Projeto que já existe é ignorado (a importação "
                                            + "só cria, nunca altera o que existe)."));
                recognition.Add(("Programa", "Pelo nome. Programa que não existe é criado, com o ícone e a cor sugeridos pelo nome. "
                                             + "Programa em que todos os projetos estão concluídos ou cancelados entra arquivado."));
                recognition.Add(("Responsável e Equipe", "Pelo nome completo, entre os voluntários da plataforma e os da aba "
                                                         + "Voluntários. Nome não encontrado aparece como aviso na conferência."));
            }
            recognition.Add(("Linha incompleta", "Linha sem um dado obrigatório (ou com valor fora da lista) aparece como erro na "
                                                 + "conferência e não entra até alguém completar; as outras linhas entram normalmente."));
            recognition.Add(("O arquivo", "Pela aba oculta Listas (tipo de arquivo e versão do modelo) e pelos nomes das abas e das "
                                          + "colunas. Arquivo de outro formato é recusado com a explicação."));
            Pairs(recognition);

            if (c.IncludeProjects)
            {
                Section("Projetos: como transformar uma informação em linha");
                var rules = new List<string>
                {
                    "Uma linha por projeto. Todo projeto pertence a um programa (coluna Programa).",
                    "Programa: se o projeto é mais um do mesmo tipo de um programa da lista (mais um banheiro, mais uma horta), use "
                    + "esse programa. Se é uma iniciativa diferente, mesmo parecida com outra, ela é um programa próprio, com o nome "
                    + "da iniciativa, escrito como a fonte escreve, com maiúscula só na primeira letra e nos nomes próprios (ex.: "
                    + "\"Mutirão de pintura da creche Pequeno Príncipe\").",
                    "Iniciativa única (a maioria): nome dela em Programa e Nome do projeto em branco.",
                    "Programa com vários projetos, ou projeto de um programa da lista: Programa com a mesma grafia em todas as linhas "
                    + "e, em Nome do projeto, \"Programa - identificação\", em que a identificação é o que a fonte usa para "
                    + "diferenciar (família ou local), como ela escreve. Ex.: \"Banheiro Direito da Gente - Dona Cleusa\", \"Horta "
                    + "comunitária - Restinga\".",
                    "Situação: terminou = Concluído; interrompido sem terminar = Cancelado; parado, mas vai voltar = Pausado; em "
                    + "execução = Em andamento; ainda não começou = Planejamento. Em Planejamento, Data de início é a data prevista."
                };
                if (nationals.Count > 0)
                    rules.Add($"Indicadores nacionais ({Names(nationals)}): siga a regra de contagem do dicionário. Projeto concluído: "
                              + "quem foi atendido. Em planejamento ou em andamento: quem o projeto vai atender (\"família de 7 "
                              + "pessoas\" → 1 e 7, mesmo com a obra em andamento). Sem o número, em branco; \"nenhuma família ainda\" "
                              + "num projeto que não começou também fica em branco (o público previsto não foi informado).");
                rules.AddRange(new[]
                {
                    "Indicadores específicos: até três pares Indicador/Valor, só com números de resultado (o que foi feito ou "
                    + "entregue, como salas pintadas ou banheiros construídos). Quantos voluntários ajudaram não é indicador: vai em "
                    + "Observações. Se houver mais de três, use os três que medem a entrega principal e anote os outros em "
                    + "Observações. Empate: siga a ordem em que aparecem na fonte. Não junte dois números num indicador só.",
                    "Nome do indicador específico: use o da lista quando servir; senão, \"Nome (unidade)\", com \"un.\" para contagem "
                    + "de coisas e a unidade de medida nos demais (m², litros, m). Ex.: \"Salas pintadas (un.)\", \"Área construída "
                    + "(m²)\". Não repita os nacionais.",
                    "No programa com vários projetos, escreva os nomes dos indicadores específicos em todos os projetos, na mesma "
                    + "ordem, mesmo quando o valor ficar em branco (ex.: área ainda não medida). Para um programa da lista, use os "
                    + "indicadores e a ordem da tabela \"Indicadores por programa\" da aba Listas; programa sem indicadores lá só "
                    + "ganha indicador se a fonte trouxer números de resultado.",
                    "Projeto em planejamento ou em andamento: indicador de entrega (banheiros construídos) conta só o que já foi "
                    + "entregue. Se a própria informação deixa claro que nada foi entregue ainda (a obra do único banheiro está em "
                    + "andamento), escreva 0; sem como saber, em branco.",
                    "Equipe: só nomes, completos e separados por ponto e vírgula, com a função entre parênteses quando souber. Quem "
                    + "coordenou ou organizou é o Responsável e também entra na equipe, como \"(Responsável pelo projeto)\". Mais de "
                    + "um coordenador: o primeiro citado é o Responsável e os outros entram só na Equipe.",
                    "Local: rua, beco ou avenida vão em Endereço; o nome do lugar (vila, bairro, comunidade) vai em Bairro; Cidade só "
                    + "se a fonte disser (não use a cidade do núcleo por conta própria); o Estado pode ser deduzido da cidade."
                });
                Numbered(rules);
            }

            if (c.IncludeVolunteers)
            {
                Section("Voluntários: como transformar uma informação em linha");
                Numbered(new[]
                {
                    "Uma linha por pessoa, inclusive quem já saiu (Ex-membro): é o que mantém o histórico e as horas de cada um.",
                    "Toda pessoa citada em Responsável ou Equipe que não está na lista da plataforma precisa de uma linha aqui, com "
                    + "o que se souber dela.",
                    "Situação: participa hoje = Ativo; pausa temporária = Afastado; cadastrado, mas sem participar = Inativo; saiu "
                    + "da organização = Ex-membro (com Saiu em, se souber). Citado como quem toca ou vai tocar um projeto em "
                    + "andamento ou em planejamento = Ativo. Sem como saber, em branco e anotado em Outras informações relevantes.",
                    "Entrou em é o primeiro dia como voluntário. Sem essa data, as horas contam a partir da importação."
                });
            }

            Section("Dicionário das colunas");
            var dictionary = new List<string[]>();
            if (c.IncludeProjects)
                dictionary.AddRange(DictionaryRows(ProjectsSheet, ProjectColumns(c.Nationals, SpecificSlots, export)));
            if (c.IncludeVolunteers)
                dictionary.AddRange(DictionaryRows(VolunteersSheet, VolunteerColumns(export)));
            Table(new[] { "Aba", "Coluna", "Obrigatória", "O que é", "Formato e valores aceitos", "Exemplo" }, dictionary);

            Section("Exemplo: de um texto solto para as linhas");
            Paragraph("Texto recebido: \"Em 2021 fizemos uma cisterna de 16 mil litros na Escola Estadual Vila Nova, de março a "
                      + "agosto. O Rodrigo Teixeira coordenou, com a Patrícia Lemos no projeto hidráulico. Atendeu uns 420 alunos e "
                      + "funcionários. O Rodrigo (rodrigo.teixeira@gmail.com, engenheiro civil) entrou em março de 2019 e saiu em "
                      + "dezembro de 2022.\"");
            var example = new List<string[]>();
            if (c.IncludeProjects)
            {
                example.AddRange(new[]
                {
                    new[] { ProjectsSheet, ProgramColumn, "Cisterna da Escola Estadual Vila Nova" },
                    new[] { ProjectsSheet, ProjectName, "(em branco: iniciativa única)" },
                    new[] { ProjectsSheet, ProjectStatusColumn, "Concluído" },
                    new[] { ProjectsSheet, Start, "01/03/2021 (só mês e ano: dia 1)" },
                    new[] { ProjectsSheet, End, "31/08/2021 (só mês e ano: último dia)" },
                    new[] { ProjectsSheet, Owner, "Rodrigo Teixeira" }
                });
                foreach (var name in nationals)
                    example.Add(new[] { ProjectsSheet, name, name == people ? "420" : "(em branco: o texto não fala disso)" });
                example.AddRange(new[]
                {
                    new[] { ProjectsSheet, "Indicador 1 / Valor 1", "Capacidade da cisterna (litros) / 16000" },
                    new[] { ProjectsSheet, Team, "Rodrigo Teixeira (Responsável pelo projeto); Patrícia Lemos (Projeto hidráulico)" },
                    new[] { ProjectsSheet, Beneficiaries, "Alunos e funcionários da escola" },
                    new[] { ProjectsSheet, TargetAudience, "420 alunos e funcionários" },
                    new[] { ProjectsSheet, Notes, people is null ? "Valor aproximado." : $"{people}: valor aproximado." }
                });
            }
            if (c.IncludeVolunteers)
            {
                example.AddRange(new[]
                {
                    new[] { VolunteersSheet, VolunteerName, "Rodrigo Teixeira" },
                    new[] { VolunteersSheet, Email, "rodrigo.teixeira@gmail.com" },
                    new[] { VolunteersSheet, VolunteerStatusColumn, "Ex-membro" },
                    new[] { VolunteersSheet, "Entrou em / Saiu em", "01/03/2019 / 31/12/2022" },
                    new[] { VolunteersSheet, Skills, "Engenharia civil" },
                    new[] { VolunteersSheet, VolunteerName, "Patrícia Lemos: outra linha, com Situação* em branco e, em Outras "
                                                            + "informações relevantes, \"Situação não informada\" (o texto não diz se ela ainda participa)" }
                });
            }
            Table(new[] { "Aba", "Coluna", "Valor" }, example);

            Section("Cor do título das colunas");
            var legend = new List<(string Sample, ColumnKind Kind, string Meaning)>
            {
                (c.IncludeProjects ? ProgramColumn : VolunteerName, ColumnKind.Required, "Obrigatória."),
                (c.IncludeProjects ? ProjectName : Email, ColumnKind.Optional, "Opcional.")
            };
            if (c.IncludeProjects && nationals.Count > 0)
                legend.Add((nationals[0], ColumnKind.National, "Indicador nacional: existe em todo projeto; o valor pode ficar em branco."));
            if (export)
                legend.Add((c.IncludeVolunteers ? Hours : ImageAuthorization, ColumnKind.ExportOnly,
                    "Calculada pela plataforma: só na exportação, ignorada na importação."));
            foreach (var (sample, kind, meaning) in legend)
            {
                var cell = Put(1, sample);
                HeaderStyle(cell.Style, kind);
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                Put(2, meaning);
                Merge(2);
                _row++;
            }
            Paragraph("Passe o mouse sobre o título de cada coluna para ver a explicação curta.", Look.Muted);

            if (export)
            {
                if (c.IncludeVolunteers)
                {
                    Section("Dados pessoais");
                    Paragraph("Este arquivo tem nome, e-mail, telefone e aniversário de voluntários. Guarde em local com acesso "
                              + "restrito e apague quando não precisar mais. A exportação fica registrada no histórico de "
                              + "alterações da plataforma.");
                }
                Section("Não vem neste arquivo");
                Paragraph("Tarefas, registros de andamento, fotos, arquivos e documentos assinados. O histórico de cada projeto "
                          + "(andamento com fotos e tarefas concluídas) fica no relatório em PDF: no projeto, \"Gerar relatório\"; de "
                          + "vários projetos, em Relatórios.");
            }
        }

        /// <summary>Uma linha por coluna; os pares Indicador/Valor viram duas linhas ("Indicador 1 a 3").</summary>
        private static IEnumerable<string[]> DictionaryRows(string sheet, IEnumerable<SheetColumn> columns)
        {
            foreach (var column in columns)
            {
                var name = column.Name;
                if (name.StartsWith(IndicatorPrefix + " ", StringComparison.Ordinal) || name.StartsWith(ValuePrefix + " ", StringComparison.Ordinal))
                {
                    if (!name.EndsWith(" 1", StringComparison.Ordinal)) continue;
                    name = $"{name} a {SpecificSlots}";
                }
                var required = column.Kind switch
                {
                    ColumnKind.Required => "Sim",
                    ColumnKind.National => "Não (a coluna existe em todo projeto; vazio = não informado)",
                    ColumnKind.ExportOnly => "Não preencha",
                    _ => "Não"
                };
                yield return new[] { sheet, name, required, column.What, column.Accepted, column.Example };
            }
        }
    }
}
