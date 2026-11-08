using System.Globalization;
using System.Text;

namespace Esf.Api.Common;

public static class TextHelpers
{
    private static readonly string[] MonthNames =
    {
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    };

    /// <summary>"Ana Aumond" -> "ana-aumond" (para nomes de arquivo).</summary>
    public static string Slug(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            builder.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-');
        }
        var slug = string.Join('-', builder.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "documento" : slug;
    }

    /// <summary>"07 de outubro de 2025" (a API roda sem dados de cultura, entao os meses ficam aqui).</summary>
    public static string LongDate(DateOnly date) => $"{date.Day:00} de {MonthNames[date.Month - 1]} de {date.Year}";

    /// <summary>Horario de Brasilia (UTC-3, sem horario de verao desde 2019) de um momento em UTC.</summary>
    public static DateTime BrasiliaTime(DateTime utc) =>
        DateTime.SpecifyKind(utc, DateTimeKind.Utc).AddHours(-3);

    /// <summary>Dia (no horario de Brasilia) de um momento em UTC: um registro das 22 h fica no proprio dia.</summary>
    public static DateOnly BrasiliaDay(DateTime utc) => DateOnly.FromDateTime(BrasiliaTime(utc));

    /// <summary>Momento em UTC em que o dia comeca em Brasilia (00:00 de Brasilia = 03:00 UTC), para filtrar periodos.</summary>
    public static DateTime BrasiliaDayStartUtc(DateOnly day) =>
        DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc).AddHours(3);

    /// <summary>12 -> "12"; 1.5 -> "1,5"; 2.25 -> "2,25" (horas lancadas).</summary>
    public static string Hours(decimal hours) =>
        Math.Round(hours, 2).ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',');
}
