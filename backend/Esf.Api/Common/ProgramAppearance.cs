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

    /// <summary>
    /// Sugestao pelo nome do programa (programa criado na importacao de planilha): icone, cor do assunto e inicios de
    /// palavra (sem acento) que o indicam. A mesma tabela de utils/programs.ts, que sugere na tela.
    /// </summary>
    private static readonly (string Icon, string Color, string[] Keywords)[] Suggestions =
    {
        ("banheiro", "blue", new[] { "banheir", "sanitari", "chuveir", "privada" }),
        ("agua", "blue", new[] { "agua", "cisterna", "poco", "chuva", "hidric", "hidraul", "abastec", "reservatori", "esgot", "saneament" }),
        ("horta", "green", new[] { "horta", "plant", "cultiv", "agro", "agricult", "jardim", "pomar", "semente", "canteir" }),
        ("arvore", "green", new[] { "arvor", "arboriz", "florest", "reflorest", "ambient", "ecolog", "praca", "parque" }),
        ("reciclagem", "teal", new[] { "recicl", "residu", "lixo", "coleta", "compost" }),
        ("alimentacao", "green", new[] { "aliment", "cozinha", "comida", "refeic", "nutri", "cesta", "merenda" }),
        ("obra", "orange", new[] { "obra", "reforma", "constru", "alvenaria", "restaur", "ampliac", "edific" }),
        ("casa", "orange", new[] { "casa", "moradi", "habitac", "residenc", "domicil" }),
        ("manutencao", "orange", new[] { "manutenc", "reparo", "conserto", "instalac" }),
        ("mobilidade", "gray", new[] { "passarela", "ponte", "pinguela", "calcad", "escada", "estrada", "travessia", "mobilidad", "transport" }),
        ("energia", "amber", new[] { "energi", "eletric", "luz", "ilumin", "fiac" }),
        ("solar", "amber", new[] { "solar", "fotovolt" }),
        ("educacao", "purple", new[] { "educa", "escola", "ensino", "aula", "alfabetiz", "bibliotec", "reforco", "estud" }),
        ("oficina", "purple", new[] { "oficina", "capacit", "curso", "treinament", "palestra", "workshop", "formac" }),
        ("comunidade", "pink", new[] { "comunidad", "comunitari", "associac", "morador", "coletiv", "mobiliz", "lideranc" }),
        ("evento", "pink", new[] { "evento", "mutirao", "festa", "feira", "campanha", "encontro" }),
        ("saude", "pink", new[] { "saude", "posto", "clinic", "hospital", "medic", "odonto", "vacin" }),
        ("acessibilidade", "teal", new[] { "acessib", "rampa", "cadeirant", "deficien", "inclus" }),
        ("diagnostico", "teal", new[] { "diagnost", "levantament", "vistori", "pesquis", "mapeament", "cadastr", "censo", "avaliac" })
    };

    /// <summary>Icone e cor sugeridos pelo nome: vale a palavra que aparece primeiro; sem nenhuma, o padrao.</summary>
    public static (string Icon, string Color) Suggest(string name)
    {
        var words = System.Text.RegularExpressions.Regex.Matches(SearchText.Fold(name), "[a-z0-9]+");
        (string Icon, string Color, int At)? best = null;
        foreach (var (icon, color, keywords) in Suggestions)
        {
            var word = words.FirstOrDefault(w => keywords.Any(k => w.Value.StartsWith(k, StringComparison.Ordinal)));
            if (word is not null && (best is null || word.Index < best.Value.At)) best = (icon, color, word.Index);
        }
        return best is { } found ? (found.Icon, found.Color) : (DefaultIcon, DefaultColor);
    }

    public static string IconOrDefault(string? icon) =>
        icon is not null && Icons.ContainsKey(icon) ? icon : DefaultIcon;

    public static string ColorOrDefault(string? color) =>
        color is not null && Colors.ContainsKey(color) ? color : DefaultColor;
}
