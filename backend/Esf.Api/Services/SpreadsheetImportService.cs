using System.ComponentModel.DataAnnotations;
using ClosedXML.Excel;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Spreadsheets;
using Microsoft.EntityFrameworkCore;
using static Esf.Api.Spreadsheets.SpreadsheetLayout;

namespace Esf.Api.Services;

/// <summary>
/// Importacao da planilha (modelo preenchido ou exportacao completada): le as abas Projetos e Voluntarios, monta a
/// conferencia (o que e novo, o que ja existe e os erros de cada linha) e, na confirmacao, cria tudo de uma vez. So
/// cria: o que ja existe na plataforma e ignorado, nunca alterado. Sem estado entre a conferencia e a confirmacao: o
/// arquivo e enviado de novo e conferido outra vez.
/// </summary>
public class SpreadsheetImportService
{
    public const long MaxFileBytes = 10 * 1024 * 1024;
    private const int MaxRows = 3000;

    private const string NotOurs =
        "Este arquivo não é uma planilha da plataforma. Baixe o modelo de importação em Configurações › Planilhas (ou use "
        + "uma exportação) e preencha nele.";

    private readonly EsfDbContext _db;

    public SpreadsheetImportService(EsfDbContext db) => _db = db;

    public async Task<ImportResultDto> ImportAsync(IFormFile? file, bool confirm)
    {
        if (file is null || file.Length == 0) throw new AppException("Escolha o arquivo da planilha (.xlsx).");
        if (file.Length > MaxFileBytes) throw new AppException("O arquivo passa de 10 MB.");

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception)
        {
            throw new AppException("Não foi possível ler o arquivo. Envie a planilha em .xlsx (Excel), baixada da plataforma.");
        }

        using (workbook)
        {
            var run = new Run(_db);
            await run.PlanAsync(workbook);
            if (confirm) await run.ApplyAsync();
            return run.ToDto(confirm);
        }
    }

    // ---------- planejamento de cada linha ----------

    private abstract class RowPlan
    {
        public required int Row { get; init; }
        public string Label { get; set; } = "";
        public string? Detail { get; set; }
        public bool Existing { get; set; }
        public List<string> Errors { get; } = new();
        public List<string> Warnings { get; } = new();
        public bool IsNew => !Existing && Errors.Count == 0;

        public ImportRowDto ToDto() => new(Row, Label, Detail,
            Errors.Count > 0 ? ImportRowResult.Error : Existing ? ImportRowResult.Existing : ImportRowResult.New,
            Errors, Warnings);
    }

    private sealed class VolunteerPlan : RowPlan
    {
        public Volunteer Entity { get; } = new();
        public List<(DateOnly On, VolunteerStatus Status)> History { get; } = new();
    }

    private sealed class ProjectPlan : RowPlan
    {
        public Project Entity { get; } = new();
        public string ProgramKey { get; set; } = "";
        public string ProgramName { get; set; } = "";
        public Dictionary<Guid, decimal?> Nationals { get; } = new();
        public List<(string Name, string? Unit, decimal? Value)> Specific { get; } = new();
        public List<(Guid VolunteerId, string? Role)> Team { get; } = new();
    }

    private sealed record ExistingVolunteer(Guid Id, string Name, string? Email);

    private sealed record ExistingProgram(Guid Id, string Name, List<(string Name, string? Unit)> Indicators);

    /// <summary>Uma importacao: dados do nucleo, as linhas lidas e o que sera criado.</summary>
    private sealed class Run
    {
        private readonly EsfDbContext _db;
        private readonly DateOnly _today = Mapping.Today;

        private string _nucleo = "";
        private List<NationalColumn> _nationals = new();
        private List<ExistingVolunteer> _volunteers = new();
        private Dictionary<string, ExistingProgram> _programs = new();
        private HashSet<(Guid ProgramId, string Name)> _projects = new();

        private string? _sourceNucleo;
        private readonly List<string> _fileWarnings = new();
        private List<VolunteerPlan>? _volunteerPlans;
        private List<ProjectPlan>? _projectPlans;
        /// <summary>Pessoas pelo nome (sem acento): as da plataforma e as novas da aba Voluntarios.</summary>
        private readonly Dictionary<string, List<Guid>> _people = new();

        public Run(EsfDbContext db) => _db = db;

        public async Task PlanAsync(XLWorkbook workbook)
        {
            Identify(workbook);
            await LoadAsync();

            workbook.TryGetWorksheet(ProjectsSheet, out var projects);
            workbook.TryGetWorksheet(VolunteersSheet, out var volunteers);
            if (projects is null && volunteers is null)
                throw new AppException($"O arquivo não tem as abas {ProjectsSheet} nem {VolunteersSheet}. Não renomeie as abas do modelo.");

            if (volunteers is not null) _volunteerPlans = PlanVolunteers(SheetReader.Read(volunteers, MaxRows));
            foreach (var volunteer in _volunteers) AddPerson(volunteer.Name, volunteer.Id);
            foreach (var plan in _volunteerPlans?.Where(p => p.IsNew) ?? Enumerable.Empty<VolunteerPlan>())
                AddPerson(plan.Entity.Name, plan.Entity.Id);
            if (projects is not null) _projectPlans = PlanProjects(SheetReader.Read(projects, MaxRows));
        }

        /// <summary>A aba oculta Listas diz o que e o arquivo, a versao do modelo e de que nucleo veio.</summary>
        private void Identify(XLWorkbook workbook)
        {
            if (!workbook.TryGetWorksheet(ListsSheet, out var lists)) throw new AppException(NotOurs);

            string? Below(string label)
            {
                var cell = lists.Row(1).CellsUsed().FirstOrDefault(c => c.GetString().Trim() == label);
                return cell is null ? null : SheetReader.Text(cell.CellBelow().Value);
            }

            if (Below(FileKindLabel) != FileKind) throw new AppException(NotOurs);
            if (!int.TryParse(Below(VersionLabel), out var version)) throw new AppException(NotOurs);
            if (version > FormatVersion)
                throw new AppException("Esta planilha é de uma versão mais nova do modelo. Atualize a página e baixe o modelo de novo.");
            _sourceNucleo = Below(NucleoLabel);
        }

        private async Task LoadAsync()
        {
            _nucleo = await _db.Organizations.AsNoTracking().Select(o => o.Name).FirstOrDefaultAsync() ?? "";
            if (_sourceNucleo is not null && _nucleo.Length > 0 && SearchText.Fold(_sourceNucleo) != SearchText.Fold(_nucleo))
                _fileWarnings.Add($"Esta planilha veio do núcleo {_sourceNucleo}. O que for importado entra no núcleo {_nucleo}.");

            _nationals = await SpreadsheetService.NationalColumnsAsync(_db);
            _volunteers = await _db.Volunteers.AsNoTracking()
                .Where(v => v.AnonymizedAt == null)
                .Select(v => new ExistingVolunteer(v.Id, v.Name, v.Email))
                .ToListAsync();

            var programs = await _db.Programs.AsNoTracking()
                .Include(p => p.TemplateIndicators)
                .ToListAsync();
            _programs = programs
                .GroupBy(p => SearchText.Fold(p.Name.Trim()))
                .ToDictionary(g => g.Key, g =>
                {
                    var p = g.First();
                    return new ExistingProgram(p.Id, p.Name, p.TemplateIndicators.Where(i => i.NationalIndicatorId == null)
                        .OrderBy(i => i.Position).Select(i => (i.Name, i.Unit)).ToList());
                });
            _projects = (await _db.Projects.AsNoTracking().Select(p => new { p.ProgramId, p.Name }).ToListAsync())
                .Select(p => (p.ProgramId, SearchText.Fold(p.Name.Trim())))
                .ToHashSet();
        }

        private void AddPerson(string name, Guid id)
        {
            var key = SearchText.Fold(name.Trim());
            if (!_people.TryGetValue(key, out var ids)) _people[key] = ids = new List<Guid>();
            if (!ids.Contains(id)) ids.Add(id);
        }

        /// <summary>Colunas que a importacao nao conhece viram um aviso do arquivo (e sao ignoradas).</summary>
        private void WarnUnknownColumns(SheetTable table, IEnumerable<string> known)
        {
            var keys = known.Select(SheetReader.Key).ToHashSet();
            var unknown = table.Headers
                .Where(h => h.Length > 0 && !keys.Contains(SheetReader.Key(h)) && !IsIndicatorPair(h))
                .ToList();
            if (unknown.Count > 0)
                _fileWarnings.Add($"Aba {table.Name}: coluna{(unknown.Count > 1 ? "s" : "")} que a importação não conhece, "
                                  + $"ignorada{(unknown.Count > 1 ? "s" : "")}: {string.Join(", ", unknown)}.");
        }

        private static bool IsIndicatorPair(string header) =>
            System.Text.RegularExpressions.Regex.IsMatch(SheetReader.Key(header), @"^(indicador|valor) \d+$");

        private static void RequireColumns(SheetTable table, params string[] names)
        {
            var missing = names.Where(n => table.Find(n) < 0).ToList();
            if (missing.Count > 0)
                throw new AppException($"A aba {table.Name} está sem a coluna {string.Join(", ", missing)}. Não renomeie nem apague "
                                       + "colunas; se precisar, baixe o modelo de novo.");
        }

        // ---------- voluntarios ----------

        private List<VolunteerPlan> PlanVolunteers(SheetTable table)
        {
            RequireColumns(table, VolunteerName, VolunteerStatusColumn);
            WarnUnknownColumns(table, VolunteerColumns(export: true).Select(c => c.Name));
            var column = VolunteerColumns(export: false).ToDictionary(c => c.Name, c => table.Find(c.Name));
            XLCellValue Cell(SheetRow row, string name) => column[name] >= 0 ? row.Values[column[name]] : Blank.Value;

            var plans = new List<VolunteerPlan>();
            var seenEmails = new Dictionary<string, int>();
            var seenNames = new Dictionary<string, (int Row, bool HasEmail)>();
            foreach (var row in table.Rows)
            {
                var plan = new VolunteerPlan { Row = row.Number };
                plans.Add(plan);
                var v = plan.Entity;
                var name = SheetReader.Text(Cell(row, VolunteerName));
                var email = SheetReader.Text(Cell(row, Email))?.ToLowerInvariant();
                plan.Label = name ?? "(sem nome)";
                plan.Detail = email;

                if (name is null)
                {
                    plan.Errors.Add("Falta o Nome.");
                    continue;
                }

                // Ja esta na plataforma: pelo e-mail; sem e-mail (aqui ou la), pelo nome completo.
                var key = SearchText.Fold(name);
                var byEmail = email is null ? null : _volunteers.FirstOrDefault(x => string.Equals(x.Email, email, StringComparison.OrdinalIgnoreCase));
                var byName = _volunteers.Where(x => SearchText.Fold(x.Name.Trim()) == key).ToList();
                if (byEmail is not null || byName.Any(x => email is null || x.Email is null))
                {
                    plan.Existing = true;
                    continue;
                }
                if (byName.Count > 0)
                    plan.Warnings.Add("Já existe um voluntário com este nome e outro e-mail. Confira se não é a mesma pessoa.");

                // Repetida na planilha: mesmo e-mail, ou mesmo nome quando uma das linhas nao tem e-mail (homonimos com
                // e-mails diferentes sao pessoas diferentes).
                int? first = null;
                if (email is not null && seenEmails.TryGetValue(email, out var sameEmail)) first = sameEmail;
                else if (seenNames.TryGetValue(key, out var sameName) && (email is null || !sameName.HasEmail)) first = sameName.Row;
                if (first is not null)
                {
                    plan.Errors.Add($"Repetido na planilha (a mesma pessoa da linha {first}).");
                    continue;
                }
                if (email is not null) seenEmails[email] = row.Number;
                seenNames.TryAdd(key, (row.Number, email is not null));

                v.Name = name;
                if (name.Length is < 3 or > 160) plan.Errors.Add("O nome deve ter entre 3 e 160 caracteres.");
                if (email is not null)
                {
                    if (email.Length > 200 || !new EmailAddressAttribute().IsValid(email)) plan.Errors.Add($"E-mail inválido: {email}.");
                    v.Email = email;
                }
                v.Phone = Limited(plan, SheetReader.Text(Cell(row, Phone)), Phone, 40);
                v.Skills = SheetReader.Text(Cell(row, Skills));
                v.Notes = SheetReader.Text(Cell(row, OtherInfo));

                var sector = SheetReader.Text(Cell(row, Sector));
                if (sector is null) v.Sector = VolunteerSector.Projetos;
                else if (Find(Sectors, sector) is { } foundSector) v.Sector = foundSector;
                else plan.Errors.Add($"Setor fora da lista: {sector}.");

                var status = SheetReader.Text(Cell(row, VolunteerStatusColumn));
                if (status is null) plan.Errors.Add("Falta a Situação (Ativo, Afastado, Inativo ou Ex-membro).");
                else if (Find(VolunteerStatuses, status) is { } foundStatus) v.Status = foundStatus;
                else plan.Errors.Add($"Situação fora da lista: {status}.");

                var joined = ReadDate(plan, Cell(row, Joined), Joined, endOfMonth: false);
                var left = ReadDate(plan, Cell(row, Left), Left, endOfMonth: true);
                if (joined > _today) plan.Errors.Add("Entrou em não pode ser depois de hoje.");

                if (!SheetReader.TryBirthday(Cell(row, Birthday), out var birthday))
                    plan.Errors.Add("Aniversário inválido: use dd/mm (ex.: 25/04).");
                v.BirthDay = birthday?.Day;
                v.BirthMonth = birthday?.Month;

                if (plan.Errors.Count == 0) PlanHistory(plan, joined, left);
            }
            return plans;
        }

        /// <summary>
        /// Historico de status a partir das datas: Ativo desde Entrou em (sem ela, desde hoje) e, para Ex-membro, Ex-membro
        /// a partir do dia seguinte a Saiu em. As horas de voluntariado saem dele.
        /// </summary>
        private void PlanHistory(VolunteerPlan plan, DateOnly? joined, DateOnly? left)
        {
            var status = plan.Entity.Status;
            var start = joined ?? _today;
            if (left.HasValue && status != VolunteerStatus.ExMembro)
                plan.Warnings.Add("Saiu em ignorado: só vale para Ex-membro.");

            switch (status)
            {
                case VolunteerStatus.ExMembro when left.HasValue:
                    if (left.Value < start) plan.Errors.Add("Saiu em não pode ser antes de Entrou em.");
                    else if (left.Value >= _today) plan.Errors.Add("Saiu em precisa ser antes de hoje.");
                    else
                    {
                        plan.History.Add((start, VolunteerStatus.Ativo));
                        plan.History.Add((left.Value.AddDays(1), VolunteerStatus.ExMembro));
                    }
                    break;
                case VolunteerStatus.ExMembro:
                    plan.History.Add((start, VolunteerStatus.ExMembro));
                    plan.Warnings.Add("Sem Saiu em: as horas de voluntariado desta pessoa ficam zeradas.");
                    break;
                case VolunteerStatus.Afastado when start < _today:
                    plan.History.Add((start, VolunteerStatus.Ativo));
                    plan.History.Add((_today, VolunteerStatus.Afastado));
                    plan.Warnings.Add("As horas contam como Ativo até hoje. Se o afastamento começou antes, ajuste o histórico na "
                                      + "página da pessoa.");
                    break;
                default:
                    plan.History.Add((start, status));
                    break;
            }
        }

        // ---------- projetos ----------

        private List<ProjectPlan> PlanProjects(SheetTable table)
        {
            RequireColumns(table, ProgramColumn, ProjectStatusColumn, Start);
            var fixedColumns = ProjectColumns(_nationals, 0, export: true).Select(c => c.Name).ToList();
            WarnUnknownColumns(table, fixedColumns);
            var indexes = new Dictionary<string, int>();
            int Index(string name) => indexes.TryGetValue(name, out var index) ? index : indexes[name] = table.Find(name);
            XLCellValue Cell(SheetRow row, int index) => index >= 0 ? row.Values[index] : Blank.Value;
            XLCellValue Named(SheetRow row, string name) => Cell(row, Index(name));

            // Pares Indicador N / Valor N, pelo numero (o modelo tem 3; a exportacao pode ter mais).
            var slots = table.Headers
                .Select((h, i) => (Match: System.Text.RegularExpressions.Regex.Match(SheetReader.Key(h), @"^indicador (\d+)$"), Index: i))
                .Where(x => x.Match.Success)
                .Select(x => (Number: int.Parse(x.Match.Groups[1].Value), Name: x.Index, Value: Index($"{ValuePrefix} {x.Match.Groups[1].Value}")))
                .OrderBy(x => x.Number)
                .ToList();
            var nationalKeys = _nationals.ToDictionary(n => SearchText.Fold(n.Name.Trim()), n => n.Id);

            var plans = new List<ProjectPlan>();
            var seen = new Dictionary<(string, string), int>();
            foreach (var row in table.Rows)
            {
                var plan = new ProjectPlan { Row = row.Number };
                plans.Add(plan);
                var p = plan.Entity;

                var programName = SheetReader.Text(Named(row, ProgramColumn));
                var givenName = SheetReader.Text(Named(row, ProjectName));
                var name = givenName ?? programName;
                plan.Label = name ?? "(sem programa)";
                plan.Detail = programName is not null && name != programName ? programName : null;
                if (programName is null)
                {
                    plan.Errors.Add("Falta o Programa.");
                    continue;
                }
                plan.ProgramName = programName;
                plan.ProgramKey = SearchText.Fold(programName);
                var program = _programs.GetValueOrDefault(plan.ProgramKey);
                var projectKey = SearchText.Fold(name!);
                if (program is not null && _projects.Contains((program.Id, projectKey)))
                {
                    plan.Existing = true;
                    continue;
                }
                if (seen.TryGetValue((plan.ProgramKey, projectKey), out var first))
                {
                    plan.Errors.Add($"Repetido na planilha (o mesmo projeto da linha {first})."
                                    + (givenName is null ? " Num programa com mais de um projeto, preencha o Nome do projeto." : ""));
                    continue;
                }
                seen[(plan.ProgramKey, projectKey)] = row.Number;

                if (programName.Length is < 3 or > 120) plan.Errors.Add("O nome do programa deve ter entre 3 e 120 caracteres.");
                if (name!.Length is < 3 or > 200) plan.Errors.Add("O nome do projeto deve ter entre 3 e 200 caracteres.");
                p.Name = name;

                var status = SheetReader.Text(Named(row, ProjectStatusColumn));
                if (status is null) plan.Errors.Add("Falta a Situação (Planejamento, Em andamento, Pausado, Concluído ou Cancelado).");
                else if (Find(ProjectStatuses, status) is { } foundStatus) p.Status = foundStatus;
                else plan.Errors.Add($"Situação fora da lista: {status}.");

                var start = ReadDate(plan, Named(row, Start), Start, endOfMonth: false);
                var end = ReadDate(plan, Named(row, End), End, endOfMonth: true);
                if (SheetReader.IsBlank(Named(row, Start))) plan.Errors.Add("Falta a Data de início.");
                if (start > _today.AddYears(10)) plan.Errors.Add("Data de início muito distante.");
                if (start.HasValue && end.HasValue && end.Value < start.Value)
                    plan.Errors.Add("O término não pode ser antes da data de início.");
                p.StartDate = start ?? _today;
                p.EndDateForecast = end;
                // Concluido ou cancelado: a coluna e o dia em que terminou.
                if (p.Status is ProjectStatus.Concluido or ProjectStatus.Cancelado && end.HasValue && end.Value <= _today)
                    p.ClosedOn = end;

                foreach (var national in _nationals)
                {
                    var index = Index(national.Name);
                    if (index < 0) continue;
                    var value = ReadNumber(plan, Cell(row, index), national.Name);
                    if (value.HasValue) plan.Nationals[national.Id] = value;
                }

                foreach (var slot in slots)
                {
                    var label = SheetReader.Text(Cell(row, slot.Name));
                    var value = ReadNumber(plan, Cell(row, slot.Value), $"{ValuePrefix} {slot.Number}");
                    if (label is null)
                    {
                        if (value.HasValue) plan.Errors.Add($"{ValuePrefix} {slot.Number} sem o nome do indicador.");
                        continue;
                    }
                    var (indicatorName, unit) = SheetReader.SplitParentheses(label);
                    if (nationalKeys.ContainsKey(SearchText.Fold(indicatorName)))
                    {
                        plan.Warnings.Add($"{label} é um indicador nacional: use a coluna própria. Ignorado em {IndicatorPrefix} {slot.Number}.");
                        continue;
                    }
                    // Indicador do modelo do programa: fica com o nome e a unidade exatamente como la.
                    var template = program?.Indicators.FirstOrDefault(i =>
                        SearchText.Fold(IndicatorLabel(i.Name, i.Unit)) == SearchText.Fold(label));
                    if (template is { Name: { } templateName }) (indicatorName, unit) = (templateName, template.Value.Unit);
                    if (plan.Specific.Any(s => SearchText.Fold(IndicatorLabel(s.Name, s.Unit)) == SearchText.Fold(IndicatorLabel(indicatorName, unit))))
                    {
                        plan.Warnings.Add($"{label} aparece duas vezes: ficou só o primeiro.");
                        continue;
                    }
                    if (indicatorName.Length is < 2 or > 200 || unit?.Length > 60)
                        plan.Errors.Add($"{IndicatorPrefix} {slot.Number}: nome entre 2 e 200 caracteres e unidade até 60.");
                    plan.Specific.Add((indicatorName, unit, value));
                }

                var owner = SheetReader.Text(Named(row, Owner));
                if (owner is not null) p.OwnerVolunteerId = Person(plan, owner, Owner, "o projeto fica sem responsável");
                foreach (var member in (SheetReader.Text(Named(row, Team)) ?? "").Split(';'))
                {
                    if (string.IsNullOrWhiteSpace(member)) continue;
                    var (memberName, role) = SheetReader.SplitParentheses(member);
                    var id = Person(plan, memberName, Team, "fica fora da equipe");
                    if (id is null || plan.Team.Any(t => t.VolunteerId == id)) continue;
                    if (role?.Length > 120) role = role[..120];
                    plan.Team.Add((id.Value, role));
                }

                p.Objective = SheetReader.Text(Named(row, Objective));
                p.Description = SheetReader.Text(Named(row, Description));
                p.Beneficiaries = Limited(plan, SheetReader.Text(Named(row, Beneficiaries)), Beneficiaries, 300);
                p.TargetAudience = Limited(plan, SheetReader.Text(Named(row, TargetAudience)), TargetAudience, 300);
                p.Address = Limited(plan, SheetReader.Text(Named(row, Address)), Address, 300);
                p.District = Limited(plan, SheetReader.Text(Named(row, District)), District, 120);
                p.City = Limited(plan, SheetReader.Text(Named(row, City)), City, 120);
                p.Notes = SheetReader.Text(Named(row, Notes));
                var state = SheetReader.Text(Named(row, State));
                if (state is not null)
                {
                    var uf = States.FirstOrDefault(s => s == state.ToUpperInvariant());
                    if (uf is null) plan.Errors.Add($"Estado fora da lista: {state} (use a sigla, como RS).");
                    p.State = uf;
                }
            }
            return plans;
        }

        /// <summary>Voluntario pelo nome completo; nao achado (ou com homonimo) vira aviso.</summary>
        private Guid? Person(ProjectPlan plan, string name, string column, string consequence)
        {
            var ids = _people.GetValueOrDefault(SearchText.Fold(name.Trim()));
            if (ids is { Count: 1 }) return ids[0];
            plan.Warnings.Add(ids is null
                ? $"{column}: {name} não está entre os voluntários ({consequence})."
                : $"{column}: há mais de um voluntário chamado {name} ({consequence}; escolha na página do projeto).");
            return null;
        }

        // ---------- leitura das celulas ----------

        private static T? Find<T>(IEnumerable<(T Value, string Label)> options, string text) where T : struct =>
            options.Where(o => SearchText.Fold(o.Label) == SearchText.Fold(text)).Select(o => (T?)o.Value).FirstOrDefault();

        /// <summary>Titulo da coluna nas mensagens (sem o asterisco de obrigatoria).</summary>
        private static string Shown(string column) => column.Replace("*", "");

        private static string? Limited(RowPlan plan, string? text, string column, int max)
        {
            if (text is null || text.Length <= max) return text;
            plan.Errors.Add($"{Shown(column)} passa de {max} caracteres.");
            return text[..max];
        }

        private static DateOnly? ReadDate(RowPlan plan, XLCellValue value, string column, bool endOfMonth)
        {
            if (!SheetReader.TryDate(value, endOfMonth, out var date))
            {
                plan.Errors.Add($"{Shown(column)} inválida: use dd/mm/aaaa.");
                return null;
            }
            if (date < MinDate)
            {
                plan.Errors.Add($"{Shown(column)} antes de 1990.");
                return null;
            }
            return date;
        }

        private static decimal? ReadNumber(RowPlan plan, XLCellValue value, string column)
        {
            if (!SheetReader.TryNumber(value, out var number) || number is < 0 or > 999999999)
            {
                plan.Errors.Add($"{Shown(column)}: escreva só um número, 0 ou mais.");
                return null;
            }
            return number;
        }

        // ---------- gravacao ----------

        /// <summary>Programas novos (na ordem em que aparecem), arquivados quando todos os projetos deles estao fechados.</summary>
        private List<(string Key, string Name, bool Archived)> NewPrograms() =>
            (_projectPlans ?? new List<ProjectPlan>())
            .Where(p => p.IsNew && !_programs.ContainsKey(p.ProgramKey))
            .GroupBy(p => p.ProgramKey)
            .Select(g => (g.Key, g.First().ProgramName,
                g.All(p => p.Entity.Status is ProjectStatus.Concluido or ProjectStatus.Cancelado)))
            .ToList();

        public async Task ApplyAsync()
        {
            var now = DateTime.UtcNow;
            foreach (var plan in _volunteerPlans?.Where(p => p.IsNew) ?? Enumerable.Empty<VolunteerPlan>())
            {
                plan.Entity.CreatedAt = now;
                _db.Volunteers.Add(plan.Entity);
                foreach (var (on, status) in plan.History)
                    _db.VolunteerStatusChanges.Add(new VolunteerStatusChange { VolunteerId = plan.Entity.Id, Status = status, StartsOn = on });
            }

            var programIds = _programs.ToDictionary(p => p.Key, p => p.Value.Id);
            foreach (var (key, name, archived) in NewPrograms())
            {
                var (icon, color) = ProgramAppearance.Suggest(name);
                var program = new ProjectProgram
                {
                    Name = name,
                    Icon = icon,
                    Color = color,
                    Status = archived ? ProgramStatus.Arquivado : ProgramStatus.Ativo,
                    CreatedAt = now
                };
                _db.Programs.Add(program);
                programIds[key] = program.Id;
            }

            foreach (var plan in _projectPlans?.Where(p => p.IsNew) ?? Enumerable.Empty<ProjectPlan>())
            {
                var project = plan.Entity;
                project.ProgramId = programIds[plan.ProgramKey];
                project.CreatedAt = now;
                project.UpdatedAt = now;
                _db.Projects.Add(project);

                // Todo projeto tem os nacionais ativos (em branco quando a planilha nao informa); depois, os especificos.
                foreach (var national in _nationals)
                    _db.Indicators.Add(new Indicator
                    {
                        ProjectId = project.Id,
                        NationalIndicatorId = national.Id,
                        Name = national.Name,
                        Unit = national.Unit,
                        Value = plan.Nationals.GetValueOrDefault(national.Id),
                        ValueUpdatedAt = plan.Nationals.GetValueOrDefault(national.Id).HasValue ? DateTime.UtcNow : null,
                        CreatedAt = now
                    });
                for (var i = 0; i < plan.Specific.Count; i++)
                    _db.Indicators.Add(new Indicator
                    {
                        ProjectId = project.Id,
                        Name = plan.Specific[i].Name,
                        Unit = plan.Specific[i].Unit,
                        Value = plan.Specific[i].Value,
                        ValueUpdatedAt = plan.Specific[i].Value.HasValue ? DateTime.UtcNow : null,
                        // Mesma ordem da planilha (a lista de indicadores segue a data de criacao).
                        CreatedAt = now.AddTicks(i + 1)
                    });

                var team = plan.Team.ToList();
                if (project.OwnerVolunteerId is { } ownerId && team.All(t => t.VolunteerId != ownerId))
                    team.Insert(0, (ownerId, null));
                foreach (var (volunteerId, role) in team)
                    _db.ProjectVolunteers.Add(new ProjectVolunteer
                    {
                        ProjectId = project.Id,
                        VolunteerId = volunteerId,
                        RoleInProject = role,
                        JoinedAt = now
                    });
            }

            await _db.SaveChangesAsync();
        }

        public ImportResultDto ToDto(bool applied)
        {
            static ImportSheetDto? Sheet(IReadOnlyCollection<RowPlan>? plans) => plans is null
                ? null
                : new ImportSheetDto(
                    plans.Count(p => p.IsNew),
                    plans.Count(p => p.Existing),
                    plans.Count(p => p.Errors.Count > 0 && !p.Existing),
                    plans.Select(p => p.ToDto()).ToList());

            return new ImportResultDto(
                _sourceNucleo,
                _fileWarnings,
                Sheet(_projectPlans),
                Sheet(_volunteerPlans),
                NewPrograms().Select(p => new ImportProgramDto(p.Name, p.Archived)).ToList(),
                applied);
        }
    }
}
