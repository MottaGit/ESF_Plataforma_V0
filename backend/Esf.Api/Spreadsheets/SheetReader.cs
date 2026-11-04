using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Esf.Api.Common;

namespace Esf.Api.Spreadsheets;

/// <summary>Uma linha com dados (Number e o numero da linha no Excel, para a conferencia).</summary>
public sealed record SheetRow(int Number, IReadOnlyList<XLCellValue> Values);

/// <summary>Uma aba de dados lida: os titulos da linha 1 e as linhas abaixo que tem algum valor.</summary>
public sealed class SheetTable
{
    public required string Name { get; init; }
    public required IReadOnlyList<string> Headers { get; init; }
    public required IReadOnlyList<SheetRow> Rows { get; init; }

    /// <summary>Posicao da coluna pelo titulo (sem diferenca de acento, maiuscula e asterisco); -1 quando nao existe.</summary>
    public int Find(string header)
    {
        var key = SheetReader.Key(header);
        for (var i = 0; i < Headers.Count; i++)
            if (SheetReader.Key(Headers[i]) == key) return i;
        return -1;
    }
}

/// <summary>Leitura das abas e conversao das celulas (texto, data, numero) como a aba Instrucoes descreve.</summary>
public static partial class SheetReader
{
    /// <summary>Titulo comparavel: sem acento, minusculo, sem asterisco e com um espaco so entre as palavras.</summary>
    public static string Key(string header) => Spaces().Replace(SearchText.Fold(header.Replace("*", "")), " ").Trim();

    public static SheetTable Read(IXLWorksheet sheet, int maxRows)
    {
        var lastColumn = sheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
        var headers = Enumerable.Range(1, lastColumn).Select(c => sheet.Cell(1, c).GetString().Trim()).ToList();

        var rows = new List<SheetRow>();
        var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;
        for (var r = 2; r <= lastRow; r++)
        {
            var values = Enumerable.Range(1, lastColumn).Select(c => Value(sheet.Cell(r, c))).ToList();
            if (values.All(IsBlank)) continue;
            if (rows.Count == maxRows)
                throw new AppException($"A aba {sheet.Name} tem mais de {maxRows} linhas. Divida em arquivos menores.");
            rows.Add(new SheetRow(r, values));
        }
        return new SheetTable { Name = sheet.Name, Headers = headers, Rows = rows };
    }

    /// <summary>Formula vale pelo ultimo resultado gravado (a planilha nao e recalculada aqui).</summary>
    private static XLCellValue Value(IXLCell cell) => cell.HasFormula ? cell.CachedValue : cell.Value;

    public static bool IsBlank(XLCellValue value) => value.IsBlank || (value.IsText && string.IsNullOrWhiteSpace(value.GetText()));

    /// <summary>Texto da celula, sem espacos sobrando; null quando vazia. Numero e data viram texto como aparecem.</summary>
    public static string? Text(XLCellValue value)
    {
        if (IsBlank(value)) return null;
        var text = value.Type switch
        {
            XLDataType.Text => value.GetText(),
            XLDataType.Number => value.GetNumber().ToString(CultureInfo.InvariantCulture),
            XLDataType.DateTime => value.GetDateTime().ToString("dd/MM/yyyy"),
            XLDataType.Boolean => value.GetBoolean() ? "Sim" : "Não",
            _ => value.ToString()
        };
        text = Spaces().Replace(text.Replace("\r\n", "\n"), m => m.Value.Contains('\n') ? m.Value : " ").Trim();
        return text.Length == 0 ? null : text;
    }

    /// <summary>
    /// Data da celula: data do Excel, numero de serie ou texto dd/mm/aaaa (tambem aaaa-mm-dd). So mes e ano (03/2021)
    /// vira o dia 1, ou o ultimo dia do mes quando endOfMonth.
    /// </summary>
    public static bool TryDate(XLCellValue value, bool endOfMonth, out DateOnly? date)
    {
        date = null;
        if (IsBlank(value)) return true;
        if (value.IsDateTime)
        {
            date = DateOnly.FromDateTime(value.GetDateTime());
            return true;
        }
        if (value.IsNumber)
        {
            var serial = value.GetNumber();
            if (serial is < 1 or > 2958465) return false;
            date = DateOnly.FromDateTime(DateTime.FromOADate(serial));
            return true;
        }
        if (!value.IsText) return false;

        var text = value.GetText().Trim();
        string[] formats = { "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy", "yyyy-MM-dd" };
        if (DateOnly.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            date = parsed;
            return true;
        }
        var monthYear = MonthYear().Match(text);
        if (monthYear.Success && int.TryParse(monthYear.Groups[1].Value, out var month) && month is >= 1 and <= 12)
        {
            var year = int.Parse(monthYear.Groups[2].Value, CultureInfo.InvariantCulture);
            date = new DateOnly(year, month, endOfMonth ? DateTime.DaysInMonth(year, month) : 1);
            return true;
        }
        return false;
    }

    /// <summary>
    /// Numero da celula: numero do Excel ou texto com virgula ou ponto decimal. "16.000" (ponto de milhar, que a regra
    /// pede para nao usar) e lido como 16000.
    /// </summary>
    public static bool TryNumber(XLCellValue value, out decimal? number)
    {
        number = null;
        if (IsBlank(value)) return true;
        if (value.IsNumber)
        {
            var raw = value.GetNumber();
            if (double.IsNaN(raw) || double.IsInfinity(raw) || Math.Abs(raw) > 1e12) return false;
            number = Math.Round((decimal)raw, 4);
            return true;
        }
        if (!value.IsText) return false;

        var text = value.GetText().Trim().Replace(" ", "");
        if (Thousands().IsMatch(text)) text = text.Replace(".", "");
        else if (text.Contains(',') && text.Contains('.')) text = text.Replace(".", "").Replace(',', '.');
        else text = text.Replace(',', '.');
        if (!decimal.TryParse(text, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture,
                out var parsed)) return false;
        number = parsed;
        return true;
    }

    /// <summary>Aniversario dd/mm (ou uma data do Excel, de onde sai o dia e o mes).</summary>
    public static bool TryBirthday(XLCellValue value, out (int Day, int Month)? birthday)
    {
        birthday = null;
        if (IsBlank(value)) return true;
        if (value.IsDateTime)
        {
            var date = value.GetDateTime();
            birthday = (date.Day, date.Month);
            return true;
        }
        var match = DayMonth().Match(Text(value) ?? "");
        if (!match.Success) return false;
        var day = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        if (month is < 1 or > 12 || day < 1 || day > DateTime.DaysInMonth(2000, month)) return false;
        birthday = (day, month);
        return true;
    }

    /// <summary>"Nome (papel)" ou "Capacidade (litros)": o texto e o que vem entre os parenteses no fim.</summary>
    public static (string Text, string? Inside) SplitParentheses(string value)
    {
        var match = TrailingParentheses().Match(value);
        if (!match.Success || match.Groups[1].Value.Trim().Length == 0) return (value.Trim(), null);
        var inside = match.Groups[2].Value.Trim();
        return (match.Groups[1].Value.Trim(), inside.Length == 0 ? null : inside);
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    [GeneratedRegex(@"^(\d{1,2})[/\-.](\d{4})$")]
    private static partial Regex MonthYear();

    [GeneratedRegex(@"^\d{1,3}(\.\d{3})+$")]
    private static partial Regex Thousands();

    [GeneratedRegex(@"^(\d{1,2})\s*/\s*(\d{1,2})$")]
    private static partial Regex DayMonth();

    [GeneratedRegex(@"^(.*?)\s*\(([^()]*)\)\s*$")]
    private static partial Regex TrailingParentheses();
}
