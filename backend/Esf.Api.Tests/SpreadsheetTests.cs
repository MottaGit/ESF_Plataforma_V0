using ClosedXML.Excel;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Esf.Api.Spreadsheets;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Planilha de programas, projetos e voluntarios: o modelo e a exportacao sao reconhecidos na importacao, a importacao
/// so cria (o que ja existe e ignorado), linha com erro nao entra e cada nucleo so enxerga os proprios registros.
/// </summary>
public class SpreadsheetTests
{
    private static async Task<byte[]> TemplateAsync(TwoNucleos f, Nucleo nucleo)
    {
        await using var db = f.Context(nucleo.Admin);
        return (await new SpreadsheetService(db, nucleo.Admin).TemplateAsync()).Content;
    }

    private static async Task<byte[]> ExportAsync(TwoNucleos f, Nucleo nucleo)
    {
        await using var db = f.Context(nucleo.Admin);
        return (await new SpreadsheetService(db, nucleo.Admin)
            .ExportAsync(new ExportSpreadsheetRequest { Projects = true, Volunteers = true })).Content;
    }

    private static async Task<ImportResultDto> ImportAsync(TwoNucleos f, Nucleo nucleo, byte[] file, bool confirm)
    {
        await using var db = f.Context(nucleo.Admin);
        var stream = new MemoryStream(file);
        return await new SpreadsheetImportService(db)
            .ImportAsync(new FormFile(stream, 0, stream.Length, "file", "planilha.xlsx"), confirm);
    }

    /// <summary>Escreve linhas numa aba pelo titulo das colunas (como alguem preenchendo o modelo).</summary>
    private static byte[] Fill(byte[] file, string sheetName, params Dictionary<string, XLCellValue>[] rows)
    {
        using var workbook = new XLWorkbook(new MemoryStream(file));
        var sheet = workbook.Worksheet(sheetName);
        var headers = sheet.Row(1).CellsUsed().ToDictionary(c => c.GetString(), c => c.Address.ColumnNumber);
        var next = (sheet.LastRowUsed()?.RowNumber() ?? 1) + 1;
        foreach (var row in rows)
        {
            foreach (var (header, value) in row) sheet.Cell(next, headers[header]).Value = value;
            next++;
        }
        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    private static async Task CreateNationalAsync(TwoNucleos f, string name, string unit)
    {
        await using var db = f.Context(new TestUser { Id = Guid.NewGuid(), IsNational = true });
        await new NationalIndicatorService(db).CreateAsync(new SaveNationalIndicatorRequest { Name = name, Unit = unit });
    }

    [Fact]
    public async Task EmptyTemplateIsRecognized()
    {
        var f = await TwoNucleos.CreateAsync();

        var result = await ImportAsync(f, f.A, await TemplateAsync(f, f.A), confirm: false);

        Assert.Equal("Nucleo A", result.SourceNucleo);
        Assert.Empty(result.FileWarnings);
        Assert.Empty(result.Projects!.Rows);
        Assert.Empty(result.Volunteers!.Rows);
        Assert.Empty(result.NewPrograms);
    }

    [Fact]
    public async Task ExportImportedBackCreatesNothing()
    {
        var f = await TwoNucleos.CreateAsync();
        await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");

        var result = await ImportAsync(f, f.A, await ExportAsync(f, f.A), confirm: false);

        Assert.Empty(result.FileWarnings);
        Assert.All(result.Projects!.Rows, row => Assert.Equal(ImportRowResult.Existing, row.Result));
        Assert.All(result.Volunteers!.Rows, row => Assert.Equal(ImportRowResult.Existing, row.Result));
        Assert.Equal(1, result.Projects.Existing);
        Assert.Equal(2, result.Volunteers.Existing);
        Assert.Empty(result.NewPrograms);
    }

    [Fact]
    public async Task ExportIsRecordedInTheHistory()
    {
        var f = await TwoNucleos.CreateAsync();
        await ExportAsync(f, f.A);

        await using var db = f.Context(f.A.Admin);
        var entry = await db.AuditEntries.SingleAsync(e => e.Action == AuditAction.Exported);
        Assert.Equal("Planilha", entry.EntityType);
        Assert.Equal("Projetos e voluntários", entry.EntityLabel);
        Assert.Equal(f.A.OrganizationId, entry.OrganizationId);
    }

    [Fact]
    public async Task ImportCreatesProgramsProjectsAndVolunteersAndSkipsRowsWithErrors()
    {
        var f = await TwoNucleos.CreateAsync();
        await CreateNationalAsync(f, "Pessoas beneficiadas", "pessoas");
        var file = await TemplateAsync(f, f.A);
        file = Fill(file, SpreadsheetLayout.VolunteersSheet,
            new()
            {
                ["Nome*"] = "Rodrigo Teixeira", ["E-mail"] = "Rodrigo.Teixeira@gmail.com", ["Situação*"] = "Ex-membro",
                ["Entrou em"] = "03/2019", ["Saiu em"] = new DateTime(2022, 12, 31), ["Competências"] = "Engenharia civil"
            },
            new() { ["Nome*"] = "Patrícia Lemos", ["Situação*"] = "Ativo", ["Aniversário (dia/mês)"] = "25/04" },
            new() { ["Nome*"] = "Sem situação" });
        file = Fill(file, SpreadsheetLayout.ProjectsSheet,
            new()
            {
                ["Programa*"] = "Cisterna da Escola Estadual Vila Nova", ["Situação*"] = "Concluído",
                ["Data de início*"] = "03/2021", ["Término (ou previsão)"] = "08/2021", ["Responsável"] = "Rodrigo Teixeira",
                ["Pessoas beneficiadas"] = 420, ["Indicador 1"] = "Capacidade da cisterna (litros)", ["Valor 1"] = "16.000",
                ["Equipe"] = "Rodrigo Teixeira (Responsável pelo projeto); Patrícia Lemos (Projeto hidráulico); Fulano Novo",
                ["Cidade"] = "Porto Alegre", ["Estado"] = "rs"
            },
            // Programa que ja existe no nucleo, escrito com outra caixa.
            new()
            {
                ["Programa*"] = "banheiros", ["Nome do projeto"] = "Banheiros - Dona Cleusa", ["Situação*"] = "Em andamento",
                ["Data de início*"] = new DateTime(2026, 1, 10)
            },
            new() { ["Programa*"] = "Horta da Restinga", ["Data de início*"] = "01/02/2024" });

        var preview = await ImportAsync(f, f.A, file, confirm: false);

        Assert.Equal((2, 0, 1), (preview.Projects!.New, preview.Projects.Existing, preview.Projects.Errors));
        Assert.Equal((2, 0, 1), (preview.Volunteers!.New, preview.Volunteers.Existing, preview.Volunteers.Errors));
        Assert.Equal(new ImportProgramDto("Cisterna da Escola Estadual Vila Nova", Archived: true), Assert.Single(preview.NewPrograms));
        var cistern = preview.Projects.Rows[0];
        Assert.Contains(cistern.Warnings, w => w.Contains("Fulano Novo"));
        Assert.Contains(preview.Projects.Rows[2].Errors, e => e.StartsWith("Falta a Situação"));
        await using (var db = f.Context(f.A.Admin))
            Assert.False(await db.Volunteers.AnyAsync(v => v.Name == "Rodrigo Teixeira"));

        var applied = await ImportAsync(f, f.A, file, confirm: true);
        Assert.True(applied.Applied);

        await using (var db = f.Context(f.A.Admin))
        {
            var program = await db.Programs.SingleAsync(p => p.Name == "Cisterna da Escola Estadual Vila Nova");
            Assert.Equal((ProgramStatus.Arquivado, "agua", "blue"), (program.Status, program.Icon, program.Color));

            var project = await db.Projects
                .Include(p => p.Indicators).Include(p => p.Volunteers).ThenInclude(v => v.Volunteer)
                .SingleAsync(p => p.ProgramId == program.Id);
            Assert.Equal("Cisterna da Escola Estadual Vila Nova", project.Name);
            Assert.Equal((new DateOnly(2021, 3, 1), new DateOnly(2021, 8, 31)), (project.StartDate, project.EndDateForecast));
            Assert.Equal("RS", project.State);
            var rodrigo = await db.Volunteers.SingleAsync(v => v.Email == "rodrigo.teixeira@gmail.com");
            Assert.Equal(rodrigo.Id, project.OwnerVolunteerId);
            Assert.Equal(420, project.Indicators.Single(i => i.NationalIndicatorId != null).Value);
            var specific = project.Indicators.Single(i => i.NationalIndicatorId == null);
            Assert.Equal(("Capacidade da cisterna", "litros", 16000m), (specific.Name, specific.Unit, specific.Value!.Value));
            Assert.Equal(new[] { ("Patrícia Lemos", "Projeto hidráulico"), ("Rodrigo Teixeira", "Responsável pelo projeto") },
                project.Volunteers.Select(v => (v.Volunteer!.Name, v.RoleInProject!)).OrderBy(x => x.Item1));

            var bathroom = await db.Projects.Include(p => p.Indicators).SingleAsync(p => p.Name == "Banheiros - Dona Cleusa");
            Assert.Equal(f.A.ProgramId, bathroom.ProgramId);
            Assert.Null(Assert.Single(bathroom.Indicators).Value);

            Assert.Equal(VolunteerStatus.ExMembro, rodrigo.Status);
            var history = await db.VolunteerStatusChanges.Where(c => c.VolunteerId == rodrigo.Id).OrderBy(c => c.StartsOn)
                .Select(c => new { c.StartsOn, c.Status }).ToListAsync();
            Assert.Equal(new[] { (new DateOnly(2019, 3, 1), VolunteerStatus.Ativo), (new DateOnly(2023, 1, 1), VolunteerStatus.ExMembro) },
                history.Select(h => (h.StartsOn, h.Status!.Value)));
            var patricia = await db.Volunteers.SingleAsync(v => v.Name == "Patrícia Lemos");
            Assert.Equal((25, 4, VolunteerSector.Projetos), (patricia.BirthDay!.Value, patricia.BirthMonth!.Value, patricia.Sector));
            Assert.False(await db.Volunteers.AnyAsync(v => v.Name == "Sem situação"));
        }

        // O mesmo arquivo de novo: o que entrou agora ja existe.
        var again = await ImportAsync(f, f.A, file, confirm: false);
        Assert.Equal((0, 2, 1), (again.Projects!.New, again.Projects.Existing, again.Projects.Errors));
        Assert.Equal((0, 2, 1), (again.Volunteers!.New, again.Volunteers.Existing, again.Volunteers.Errors));
        Assert.Empty(again.NewPrograms);
    }

    [Fact]
    public async Task RepeatedRowsAreErrors()
    {
        var f = await TwoNucleos.CreateAsync();
        var file = Fill(await TemplateAsync(f, f.A), SpreadsheetLayout.ProjectsSheet,
            new() { ["Programa*"] = "Mutirão de pintura", ["Situação*"] = "Concluído", ["Data de início*"] = "10/05/2024" },
            new() { ["Programa*"] = "Mutirao de Pintura", ["Situação*"] = "Concluído", ["Data de início*"] = "11/05/2024" });

        var result = await ImportAsync(f, f.A, file, confirm: false);

        Assert.Equal(ImportRowResult.New, result.Projects!.Rows[0].Result);
        Assert.Equal(ImportRowResult.Error, result.Projects.Rows[1].Result);
        Assert.Contains("linha 2", result.Projects.Rows[1].Errors[0]);
    }

    [Fact]
    public async Task OtherFilesAreRefused()
    {
        var f = await TwoNucleos.CreateAsync();
        using var workbook = new XLWorkbook();
        workbook.AddWorksheet("Projetos").Cell(1, 1).Value = "Programa*";
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var notOurs = await Assert.ThrowsAsync<AppException>(() => ImportAsync(f, f.A, stream.ToArray(), confirm: false));
        Assert.Contains("não é uma planilha da plataforma", notOurs.Message);
        var notExcel = await Assert.ThrowsAsync<AppException>(() => ImportAsync(f, f.A, "a;b;c"u8.ToArray(), confirm: false));
        Assert.Contains("Não foi possível ler o arquivo", notExcel.Message);
    }

    [Fact]
    public async Task EachNucleoComparesAndCreatesOnlyItsOwnRecords()
    {
        var f = await TwoNucleos.CreateAsync();

        // A exportacao do nucleo A importada no B: nada de A conta como existente, e tudo entra no B.
        var result = await ImportAsync(f, f.B, await ExportAsync(f, f.A), confirm: true);

        Assert.Contains(result.FileWarnings, w => w.Contains("Nucleo A") && w.Contains("Nucleo B"));
        Assert.Equal(1, result.Projects!.New);
        Assert.Equal(2, result.Volunteers!.New);
        await using var system = f.SystemContext();
        var copy = await system.Projects.SingleAsync(p => p.Name == "Projeto a" && p.OrganizationId == f.B.OrganizationId);
        Assert.Equal(f.B.ProgramId, copy.ProgramId);
        Assert.Equal(2, await system.Volunteers.CountAsync(v => v.Email == "voluntario.a@teste.org"));
        Assert.Equal(1, await system.Projects.CountAsync(p => p.OrganizationId == f.A.OrganizationId));
    }
}
