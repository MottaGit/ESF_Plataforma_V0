namespace Esf.Api.Common;

/// <summary>
/// Icones e cores que um programa pode ter. Sao chaves fixas: a tela transforma cada uma no desenho e na cor
/// (a lista da tela, em utils/programs.ts, precisa ter as mesmas chaves).
/// </summary>
public static class ProgramAppearance
{
    public const string DefaultIcon = "pin";
    public const string DefaultColor = "teal";

    /// <summary>Chave do icone e o nome dele em portugues (aparece no historico de alteracoes).</summary>
    public static readonly Dictionary<string, string> Icons = new(StringComparer.Ordinal)
    {
        ["banheiro"] = "Banheiro", ["agua"] = "Água e saneamento", ["horta"] = "Horta", ["arvore"] = "Meio ambiente",
        ["reciclagem"] = "Reciclagem", ["alimentacao"] = "Alimentação", ["obra"] = "Obra e reforma",
        ["casa"] = "Moradia", ["manutencao"] = "Manutenção e reparos", ["mobilidade"] = "Mobilidade e acesso",
        ["energia"] = "Energia e elétrica", ["solar"] = "Energia solar", ["educacao"] = "Educação",
        ["oficina"] = "Oficina e capacitação", ["comunidade"] = "Comunidade", ["evento"] = "Evento e campanha",
        ["saude"] = "Saúde", ["acessibilidade"] = "Acessibilidade", ["diagnostico"] = "Diagnóstico e levantamento",
        ["pin"] = "Outro"
    };

    public static readonly Dictionary<string, string> Colors = new(StringComparer.Ordinal)
    {
        ["teal"] = "Verde-azulado", ["blue"] = "Azul", ["green"] = "Verde", ["amber"] = "Amarelo",
        ["orange"] = "Laranja", ["red"] = "Vermelho", ["purple"] = "Roxo", ["pink"] = "Rosa", ["gray"] = "Cinza"
    };

    public static string IconOrDefault(string? icon) =>
        icon is not null && Icons.ContainsKey(icon) ? icon : DefaultIcon;

    public static string ColorOrDefault(string? color) =>
        color is not null && Colors.ContainsKey(color) ? color : DefaultColor;
}
