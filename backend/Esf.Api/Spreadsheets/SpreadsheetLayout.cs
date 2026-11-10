using Esf.Api.Domain;

namespace Esf.Api.Spreadsheets;

/// <summary>Tipo de coluna: define a cor do titulo e se a importacao le a coluna.</summary>
public enum ColumnKind
{
    Required,
    Optional,
    /// <summary>Indicador nacional: a coluna existe em todo projeto; o valor pode ficar em branco.</summary>
    National,
    /// <summary>Calculada pela plataforma: so na exportacao, ignorada na importacao.</summary>
    ExportOnly
}

/// <summary>
/// Uma coluna da planilha: titulo, tipo, largura, formato da celula, o que e, formato/valores aceitos e exemplo. O
/// comentario do titulo e a linha do dicionario (aba Instrucoes) saem daqui.
/// </summary>
public record SheetColumn(string Name, ColumnKind Kind, double Width, string? Format, string What, string Accepted, string Example);

/// <summary>Coluna com o valor de cada linha na exportacao.</summary>
public sealed record SheetColumn<T>(string Name, ColumnKind Kind, double Width, string? Format, string What, string Accepted,
    string Example, Func<T, object?> Value) : SheetColumn(Name, Kind, Width, Format, What, Accepted, Example);

/// <summary>Uma linha da aba Projetos (exportacao).</summary>
public record ProjectSheetRow(
    string Program,
    string? Name,
    ProjectStatus Status,
    DateOnly Start,
    DateOnly? End,
    string? Owner,
    IReadOnlyDictionary<Guid, decimal?> Nationals,
    IReadOnlyList<(string Name, decimal? Value)> Specific,
    string? Team,
    string? Objective,
    string? Description,
    string? Beneficiaries,
    string? TargetAudience,
    string? Address,
    string? District,
    string? City,
    string? State,
    string? Notes,
    DateOnly? ImageAuthorizedOn);

/// <summary>Uma linha da aba Voluntarios (exportacao).</summary>
public record VolunteerSheetRow(
    string Name,
    string? Email,
    string? Phone,
    VolunteerSector Sector,
    VolunteerStatus Status,
    DateOnly? Joined,
    DateOnly? Left,
    int? BirthDay,
    int? BirthMonth,
    string? Skills,
    string? Notes,
    DateOnly? TermSignedOn,
    int Hours,
    string Access);

/// <summary>Uma linha da aba Programas (resumo, so na exportacao).</summary>
public record ProgramSheetRow(string Name, bool Archived, int Projects, int Open, IReadOnlyList<string> Indicators);

/// <summary>Indicador nacional como a planilha usa: uma coluna fixa na aba Projetos.</summary>
public record NationalColumn(Guid Id, string Name, string? Unit, string? Description);

/// <summary>
/// Formato da planilha de programas, projetos e voluntarios: abas, colunas e valores de lista. O mesmo formato serve
/// para exportar, para o modelo vazio e para a leitura da importacao.
/// </summary>
public static class SpreadsheetLayout
{
    /// <summary>Identificacao do arquivo (aba oculta Listas): a importacao recusa o que nao tiver isto.</summary>
    public const string FileKind = "Planilha ESF: programas, projetos e voluntários";

    /// <summary>Versao do formato. A importacao aceita esta e as anteriores; mudou coluna, sobe o numero.</summary>
    public const int FormatVersion = 4;

    public const string InstructionsSheet = "Instruções";
    public const string ProgramsSheet = "Programas";
    public const string ProjectsSheet = "Projetos";
    public const string VolunteersSheet = "Voluntários";
    public const string ListsSheet = "Listas";

    public const string FileKindLabel = "Tipo de arquivo";
    public const string VersionLabel = "Versão do modelo";
    public const string NucleoLabel = "Núcleo";

    /// <summary>Pares Indicador/Valor do modelo (a exportacao abre mais, se algum programa tiver mais indicadores).</summary>
    public const int SpecificSlots = 3;

    public const string DateFormat = "dd/mm/yyyy";
    public static readonly DateOnly MinDate = new(1990, 1, 1);

    // ---------- titulos das colunas lidas na importacao ----------

    public const string ProgramColumn = "Programa*";
    public const string ProjectName = "Nome do projeto";
    public const string ProjectStatusColumn = "Situação*";
    public const string Start = "Data de início*";
    public const string End = "Término (ou previsão)";
    public const string Owner = "Responsável";
    public const string Team = "Equipe";
    public const string Objective = "Objetivo";
    public const string Description = "Descrição";
    public const string Beneficiaries = "Comunidade ou família atendida";
    public const string TargetAudience = "Quem se beneficia";
    public const string Address = "Endereço";
    public const string District = "Bairro";
    public const string City = "Cidade";
    public const string State = "Estado";
    public const string Notes = "Observações";
    public const string ImageAuthorization = "Autorização de imagem";
    public const string IndicatorPrefix = "Indicador";
    public const string ValuePrefix = "Valor";

    public const string VolunteerName = "Nome*";
    public const string Email = "E-mail";
    public const string Phone = "Telefone";
    public const string Sector = "Setor";
    public const string VolunteerStatusColumn = "Situação*";
    public const string Joined = "Entrou em";
    public const string Left = "Saiu em";
    public const string Birthday = "Aniversário (dia/mês)";
    public const string Skills = "Competências";
    public const string OtherInfo = "Outras informações relevantes";
    public const string Term = "Termo de adesão";
    public const string Hours = "Horas de voluntariado";
    public const string Access = "Acesso à plataforma";

    // ---------- valores de lista ----------

    public static readonly IReadOnlyList<(ProjectStatus Value, string Label)> ProjectStatuses = new[]
    {
        (ProjectStatus.Planejamento, "Planejamento"), (ProjectStatus.EmAndamento, "Em andamento"),
        (ProjectStatus.Pausado, "Pausado"), (ProjectStatus.Concluido, "Concluído"), (ProjectStatus.Cancelado, "Cancelado")
    };

    public static readonly IReadOnlyList<(VolunteerStatus Value, string Label)> VolunteerStatuses = new[]
    {
        (VolunteerStatus.Ativo, "Ativo"), (VolunteerStatus.Inativo, "Inativo"),
        (VolunteerStatus.ExMembro, "Ex-membro"), (VolunteerStatus.Afastado, "Afastado")
    };

    public static readonly IReadOnlyList<(VolunteerSector Value, string Label)> Sectors = new[]
    {
        (VolunteerSector.Projetos, "Projetos"), (VolunteerSector.Juridico, "Jurídico"), (VolunteerSector.Pessoas, "Pessoas"),
        (VolunteerSector.Comunicacao, "Comunicação"), (VolunteerSector.Qualidade, "Qualidade"),
        (VolunteerSector.Financeiro, "Financeiro")
    };

    public static readonly IReadOnlyList<string> States = new[]
    {
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ",
        "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    };

    public static string Label(ProjectStatus status) => ProjectStatuses.First(s => s.Value == status).Label;
    public static string Label(VolunteerStatus status) => VolunteerStatuses.First(s => s.Value == status).Label;
    public static string Label(VolunteerSector sector) => Sectors.First(s => s.Value == sector).Label;

    /// <summary>Indicador como a planilha escreve: "Nome (unidade)".</summary>
    public static string IndicatorLabel(string name, string? unit) =>
        string.IsNullOrWhiteSpace(unit) ? name : $"{name} ({unit})";

    // ---------- colunas ----------

    private const string DateStart =
        "Data dd/mm/aaaa. Só mês e ano: use o dia 1 (03/2021 → 01/03/2021). Só o ano: deixe em branco e anote o ano em Observações.";
    private const string DateEnd = "Data dd/mm/aaaa. Só mês e ano: use o último dia do mês (08/2021 → 31/08/2021).";
    private const string BlankRule = "Em branco = não informado; 0 = zero (só escreva 0 se a fonte disser zero).";

    private static string Date(DateOnly? date) => date?.ToString("dd/MM/yyyy") ?? "";

    /// <summary>Colunas da aba Projetos: as fixas, uma por indicador nacional e os pares de indicadores especificos.</summary>
    public static List<SheetColumn<ProjectSheetRow>> ProjectColumns(IReadOnlyList<NationalColumn> nationals, int slots, bool export)
    {
        var columns = new List<SheetColumn<ProjectSheetRow>>
        {
            new(ProgramColumn, ColumnKind.Required, 34, null,
                "Programa ao qual o projeto pertence. Num programa de um projeto só, é o nome da iniciativa.",
                "Texto, com a mesma grafia em todos os projetos do programa. Programa que não existe na plataforma é criado na importação.",
                "Banheiro Direito da Gente", r => r.Program),
            new(ProjectName, ColumnKind.Optional, 40, null, "Nome do projeto.",
                "Texto. Em branco: o projeto recebe o nome do programa (programa de um projeto só). Obrigatório quando o programa tem mais de um projeto.",
                "Banheiro Direito da Gente - Sra. Julia", r => r.Name),
            new(ProjectStatusColumn, ColumnKind.Required, 13, null, "Situação do projeto hoje.",
                "Um destes: Planejamento (ainda não começou); Em andamento; Pausado (parado, vai voltar); Concluído (terminou); Cancelado (encerrado sem terminar).",
                "Concluído", r => Label(r.Status)),
            new(Start, ColumnKind.Required, 12, DateFormat, "Primeiro dia do projeto.", DateStart, "08/03/2021", r => r.Start),
            new(End, ColumnKind.Optional, 12, DateFormat,
                "Concluído ou cancelado: dia em que terminou. Em aberto: previsão de término.", DateEnd, "20/08/2021", r => r.End),
            new(Owner, ColumnKind.Optional, 18, null, "Voluntário responsável pelo projeto.",
                "Nome completo, igual ao da aba Voluntários (ou ao cadastro da plataforma). Um nome só: com mais de um coordenador, o primeiro citado.",
                "Rodrigo Teixeira", r => r.Owner)
        };

        foreach (var national in nationals)
        {
            var unit = string.IsNullOrWhiteSpace(national.Unit) ? "" : $" ({national.Unit})";
            var rule = string.IsNullOrWhiteSpace(national.Description) ? "" : $" Como contar: {national.Description}";
            columns.Add(new(national.Name, ColumnKind.National, 12, "General",
                $"Indicador nacional{unit}, obrigatório em todo projeto.{rule}",
                $"Número inteiro, 0 ou mais. {BlankRule}",
                Common.SearchText.Fold(national.Name).Contains("pessoa") ? "420" : "1",
                r => r.Nationals.GetValueOrDefault(national.Id)));
        }

        for (var i = 1; i <= slots; i++)
        {
            var index = i - 1;
            columns.Add(new($"{IndicatorPrefix} {i}", ColumnKind.Optional, 26, null,
                "Indicador específico do programa (além dos nacionais).",
                "Texto no formato \"Nome (unidade)\". Mesmo nome e mesma ordem em todos os projetos do programa. Não repita aqui os nacionais.",
                "Capacidade da cisterna (litros)", r => index < r.Specific.Count ? r.Specific[index].Name : null));
            columns.Add(new($"{ValuePrefix} {i}", ColumnKind.Optional, 8, "General",
                "Valor do indicador escrito na coluna Indicador do mesmo número (Valor 1 é do Indicador 1).",
                $"Número, 0 ou mais (decimal com vírgula ou ponto). {BlankRule}", "16000",
                r => index < r.Specific.Count ? r.Specific[index].Value : null));
        }

        columns.AddRange(new SheetColumn<ProjectSheetRow>[]
        {
            new(Team, ColumnKind.Optional, 60, null, "Voluntários que trabalharam no projeto (o responsável também).",
                "Nomes completos separados por ponto e vírgula, com a função entre parênteses (opcional).",
                "Rodrigo Teixeira (Responsável pelo projeto); Patrícia Lemos (Projeto hidráulico)", r => r.Team),
            new(Objective, ColumnKind.Optional, 40, null, "O que o projeto quer alcançar.", "Texto livre, uma ou duas frases.",
                "Reduzir a falta de água nos banheiros da escola.", r => r.Objective),
            new(Description, ColumnKind.Optional, 50, null, "O que foi (ou será) feito.", "Texto livre, sem formatação.",
                "Cisterna de 16 mil litros com captação do telhado da escola.", r => r.Description),
            new(Beneficiaries, ColumnKind.Optional, 26, null,
                "Quem é atendido: o nome da família, da comunidade ou da instituição.", "Texto (nome, não número).",
                "Alunos e funcionários da escola", r => r.Beneficiaries),
            new(TargetAudience, ColumnKind.Optional, 30, null, "Quantas pessoas e qual o perfil, em texto para leitura.",
                "Texto (ex.: 5 pessoas, 1 idosa). Os números para somar vão nos indicadores.", "420 alunos e funcionários",
                r => r.TargetAudience),
            new(Address, ColumnKind.Optional, 18, null, "Rua, beco ou avenida, com o número se houver.", "Texto.",
                "Rua das Flores, 120", r => r.Address),
            new(District, ColumnKind.Optional, 22, null, "Nome do lugar: vila, bairro ou comunidade.", "Texto.", "Vila Nova",
                r => r.District),
            new(City, ColumnKind.Optional, 13, null, "Cidade.", "Texto.", "Porto Alegre", r => r.City),
            new(State, ColumnKind.Optional, 8, null, "Estado.", "Sigla com 2 letras (RS, SC, PR...).", "RS", r => r.State),
            new(Notes, ColumnKind.Optional, 40, null, "O que não coube nas outras colunas.",
                "Texto livre: de onde veio a informação, valores aproximados, campo obrigatório que faltou.",
                "Valores aproximados, informados pela direção da escola.", r => r.Notes)
        });

        if (export)
        {
            columns.Add(new(ImageAuthorization, ColumnKind.ExportOnly, 22, null,
                "Autorização de uso de imagem dos beneficiários (o PDF não vem na planilha).",
                "Só na exportação: \"Assinada em dd/mm/aaaa\" ou \"Pendente\". Não preencha.", "Pendente",
                r => r.ImageAuthorizedOn.HasValue ? $"Assinada em {Date(r.ImageAuthorizedOn)}" : "Pendente"));
        }
        return columns;
    }

    public static List<SheetColumn<VolunteerSheetRow>> VolunteerColumns(bool export)
    {
        var columns = new List<SheetColumn<VolunteerSheetRow>>
        {
            new(VolunteerName, ColumnKind.Required, 22, null, "Nome completo da pessoa.", "Texto.", "Patrícia Lemos", r => r.Name),
            new(Email, ColumnKind.Optional, 30, null,
                "E-mail da pessoa. É o que a identifica na importação; se ela tiver acesso, é o login.", "Um e-mail válido.",
                "patricia.lemos@gmail.com", r => r.Email),
            new(Phone, ColumnKind.Optional, 17, "@", "Telefone com DDD.", "Texto, em qualquer formato.", "(51) 99000-0115",
                r => r.Phone),
            new(Sector, ColumnKind.Optional, 14, null, "Setor da organização.",
                "Um destes: Projetos; Jurídico; Pessoas; Comunicação; Qualidade; Financeiro. Em branco: Projetos.", "Projetos",
                r => Label(r.Sector)),
            new(VolunteerStatusColumn, ColumnKind.Required, 12, null, "Situação da pessoa hoje.",
                "Um destes: Ativo (participa hoje); Afastado (pausa temporária); Inativo (cadastrado, sem participar); Ex-membro (saiu da organização).",
                "Ex-membro", r => Label(r.Status)),
            new(Joined, ColumnKind.Optional, 12, DateFormat, "Primeiro dia como voluntário (conta para as horas e o certificado).",
                "Data dd/mm/aaaa. Só mês e ano: use o dia 1.", "03/02/2020", r => r.Joined),
            new(Left, ColumnKind.Optional, 12, DateFormat, "Último dia na organização (só para Ex-membro).", DateEnd,
                "15/12/2023", r => r.Left),
            new(Birthday, ColumnKind.Optional, 12, "@", "Aniversário, sem o ano.", "dd/mm.", "25/04",
                r => r.BirthDay.HasValue && r.BirthMonth.HasValue ? $"{r.BirthDay:00}/{r.BirthMonth:00}" : null),
            new(Skills, ColumnKind.Optional, 40, null, "Formação e habilidades.", "Texto livre.",
                "Engenharia elétrica, instalações prediais", r => r.Skills),
            new(OtherInfo, ColumnKind.Optional, 40, null, "Outras informações.",
                "Texto livre. Nada de CPF, saúde, religião ou origem.", "Coordenou o núcleo de 2021 a 2023.", r => r.Notes)
        };

        if (export)
        {
            columns.Add(new(Term, ColumnKind.ExportOnly, 22, null, "Termo de adesão e uso de imagem (o PDF não vem na planilha).",
                "Só na exportação: \"Assinado em dd/mm/aaaa\" ou \"Pendente\". Não preencha.", "Pendente",
                r => r.TermSignedOn.HasValue ? $"Assinado em {Date(r.TermSignedOn)}" : "Pendente"));
            columns.Add(new(Hours, ColumnKind.ExportOnly, 13, "0", "Dias como Ativo × 6 h por semana, até a data da exportação.",
                "Só na exportação. Não preencha.", "1209", r => r.Hours));
            columns.Add(new(Access, ColumnKind.ExportOnly, 15, null, "Perfil de acesso, quando a pessoa tem login.",
                "Só na exportação. A importação nunca cria acesso. Não preencha.", "Sem acesso", r => r.Access));
        }
        return columns;
    }

    public static readonly IReadOnlyList<SheetColumn<ProgramSheetRow>> ProgramColumns = new SheetColumn<ProgramSheetRow>[]
    {
        new("Programa", ColumnKind.ExportOnly, 46, null, "Programa (sai da coluna Programa da aba Projetos).", "Só consulta.", "",
            r => r.Name),
        new("Situação", ColumnKind.ExportOnly, 11, null,
            "Ativo fica no topo da lista de programas da tela Projetos; Arquivado, no grupo Arquivados (continua nos números).",
            "Só consulta.", "", r => r.Archived ? "Arquivado" : "Ativo"),
        new("Projetos", ColumnKind.ExportOnly, 9, "0", "Quantos projetos o programa tem.", "Só consulta.", "", r => r.Projects),
        new("Em aberto", ColumnKind.ExportOnly, 9, "0", "Projetos em Planejamento, Em andamento ou Pausado.", "Só consulta.", "",
            r => r.Open),
        new("Indicadores específicos", ColumnKind.ExportOnly, 60, null,
            "Indicadores do programa além dos nacionais (as colunas Indicador 1 a 3 dos projetos dele).", "Só consulta.", "",
            r => string.Join("; ", r.Indicators))
    };
}
