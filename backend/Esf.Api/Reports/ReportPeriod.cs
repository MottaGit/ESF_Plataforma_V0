namespace Esf.Api.Reports;

/// <summary>
/// Periodo de referencia do relatorio por extenso: o nome quando e um mes, trimestre ou ano fechado ("3º trimestre de
/// 2026") e as datas ("01/07/2026 a 30/09/2026"). Usado no titulo do PDF e no nome do arquivo.
/// </summary>
public static class ReportPeriod
{
    private static readonly string[] MonthNames =
    {
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    };

    private static DateOnly EndOfMonth(int year, int month) => new(year, month, DateTime.DaysInMonth(year, month));

    /// <summary>"outubro de 2026", "3º trimestre de 2026", "ano de 2026"; null quando nao e um periodo fechado.</summary>
    public static string? Name(DateOnly? from, DateOnly? to)
    {
        if (from is not { Day: 1 } start || to is not { } end || end.Year != start.Year) return null;

        if (start.Month == 1 && end == new DateOnly(end.Year, 12, 31))
            return $"ano de {start.Year}";
        if (start.Month % 3 == 1 && end == EndOfMonth(start.Year, start.Month + 2))
            return $"{(start.Month + 2) / 3}º trimestre de {start.Year}";
        if (end == EndOfMonth(start.Year, start.Month))
            return $"{MonthNames[start.Month - 1]} de {start.Year}";
        return null;
    }

    /// <summary>"01/07/2026 a 30/09/2026", "a partir de ...", "até ..." ou "todo o histórico".</summary>
    public static string Dates(DateOnly? from, DateOnly? to) => (from, to) switch
    {
        ({ } start, { } end) => $"{start:dd/MM/yyyy} a {end:dd/MM/yyyy}",
        ({ } start, null) => $"a partir de {start:dd/MM/yyyy}",
        (null, { } end) => $"até {end:dd/MM/yyyy}",
        _ => "todo o histórico"
    };

    /// <summary>Pedaco do nome do arquivo: "2026-10", "2026-t3", "2026", "20260701-20260915"; sem periodo, o dia de hoje.</summary>
    public static string FileSuffix(DateOnly? from, DateOnly? to, DateOnly today)
    {
        var name = Name(from, to);
        if (name != null && from is { } start)
        {
            if (name.StartsWith("ano")) return $"{start.Year}";
            if (name.Contains("trimestre")) return $"{start.Year}-t{(start.Month + 2) / 3}";
            return $"{start.Year}-{start.Month:00}";
        }

        return (from, to) switch
        {
            ({ } a, { } b) => $"{a:yyyyMMdd}-{b:yyyyMMdd}",
            ({ } a, null) => $"desde-{a:yyyyMMdd}",
            (null, { } b) => $"ate-{b:yyyyMMdd}",
            _ => $"{today:yyyyMMdd}"
        };
    }
}
