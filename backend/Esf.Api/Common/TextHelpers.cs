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
}
