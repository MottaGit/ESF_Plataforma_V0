using System.ComponentModel.DataAnnotations;
using Esf.Api.Domain;

namespace Esf.Api.Dtos;

/// <summary>Que certificado gerar: periodo completo (do historico), um periodo escolhido ou a participacao num projeto.</summary>
public enum CertificateKind
{
    /// <summary>Periodo escolhido, com a carga semanal informada.</summary>
    Period = 0,

    /// <summary>Do inicio ao fim dos periodos como Ativo no historico, com as horas que a plataforma calcula.</summary>
    Full = 1,

    /// <summary>Participacao num projeto: descricao do projeto, o que a pessoa fez e as horas lancadas.</summary>
    Project = 2
}

/// <summary>Opcoes do certificado de voluntariado. O CPF entra so no PDF: nao e guardado.</summary>
public class CertificateRequest
{
    public CertificateKind Kind { get; set; } = CertificateKind.Period;

    /// <summary>Periodo (escolhido ou do projeto); no periodo completo, vem do historico.</summary>
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    [Range(1, 60, ErrorMessage = "Informe de 1 a 60 horas por semana.")]
    public int WeeklyHours { get; set; } = 6;

    [StringLength(20)]
    public string? Cpf { get; set; }

    public Guid? ProjectId { get; set; }

    [StringLength(CertificateLimits.Summary, ErrorMessage = "Resuma o projeto em até 300 caracteres.")]
    public string? ProjectSummary { get; set; }

    [StringLength(CertificateLimits.Activities, ErrorMessage = "Resuma o que a pessoa fez em até 400 caracteres.")]
    public string? Activities { get; set; }

    /// <summary>Certificado por projeto: inclui as horas lancadas no periodo.</summary>
    public bool IncludeHours { get; set; } = true;
}

/// <summary>Tamanho dos textos do certificado por projeto (cabem na pagina sem apertar).</summary>
public static class CertificateLimits
{
    public const int Summary = 300;
    public const int Activities = 400;
}

/// <summary>O que a janela do certificado ja mostra preenchido: o periodo completo e os projetos da pessoa.</summary>
public record CertificateOptionsDto(CertificateFullPeriodDto? Full, List<CertificateProjectDto> Projects);

public record CertificateFullPeriodDto(DateOnly Start, DateOnly End, int Hours, int WeeklyHours);

/// <summary>Projeto da pessoa com o periodo sugerido, as horas lancadas e os textos sugeridos.</summary>
public record CertificateProjectDto(
    Guid ProjectId,
    string Name,
    string ProgramName,
    ProjectStatus Status,
    DateOnly Start,
    DateOnly End,
    decimal Hours,
    string? Summary,
    string? Activities);
