using System.Text;

namespace Esf.Api.Common;

/// <summary>
/// Texto para a busca geral: sem acento e em minusculas, igual a funcao esf_fold do banco (as duas usam a mesma
/// tabela, entao "joao" acha "João" e vice-versa).
/// </summary>
public static class SearchText
{
    public const string Accented = "ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ";
    public const string Plain = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn";

    public static string Fold(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            var index = Accented.IndexOf(c);
            builder.Append(char.ToLowerInvariant(index >= 0 ? Plain[index] : c));
        }
        return builder.ToString();
    }

    /// <summary>"%termo%" para LIKE, com % e _ do proprio termo escapados (escape: barra invertida).</summary>
    public static string ContainsPattern(string folded) =>
        "%" + folded.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
