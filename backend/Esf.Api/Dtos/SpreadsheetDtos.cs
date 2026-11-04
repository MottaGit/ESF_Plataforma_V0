namespace Esf.Api.Dtos;

/// <summary>O que entra na planilha exportada (ao menos um).</summary>
public class ExportSpreadsheetRequest
{
    /// <summary>Aba Projetos, com o resumo dos programas.</summary>
    public bool Projects { get; set; }

    /// <summary>Aba Voluntarios (dados pessoais).</summary>
    public bool Volunteers { get; set; }
}

/// <summary>Resultado de uma linha na conferencia da importacao.</summary>
public enum ImportRowResult
{
    /// <summary>Vai ser criado (ou foi, depois da confirmacao).</summary>
    New,
    /// <summary>Ja esta na plataforma: ignorado.</summary>
    Existing,
    /// <summary>Falta dado obrigatorio ou ha valor invalido: nao entra.</summary>
    Error
}

/// <summary>Uma linha da planilha: numero da linha no Excel, o que e, resultado, erros e avisos.</summary>
public record ImportRowDto(
    int Row,
    string Label,
    string? Detail,
    ImportRowResult Result,
    List<string> Errors,
    List<string> Warnings);

public record ImportSheetDto(int New, int Existing, int Errors, List<ImportRowDto> Rows);

/// <summary>Programa que a importacao cria (arquivado quando todos os projetos dele estao fechados).</summary>
public record ImportProgramDto(string Name, bool Archived);

/// <summary>
/// Conferencia da importacao (Applied = false) ou o que foi gravado (Applied = true). Uma aba ausente no arquivo vem
/// vazia (null).
/// </summary>
public record ImportResultDto(
    string? SourceNucleo,
    List<string> FileWarnings,
    ImportSheetDto? Projects,
    ImportSheetDto? Volunteers,
    List<ImportProgramDto> NewPrograms,
    bool Applied);
