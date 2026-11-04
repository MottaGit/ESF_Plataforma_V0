namespace Esf.Api.Domain.Entities;

/// <summary>
/// Horas de voluntariado lancadas num projeto: quem, em que dia, quantas horas e, se quiser, o que fez. A propria pessoa
/// lanca as suas (no projeto ou ao registrar o andamento); a coordenacao lanca e corrige as de qualquer um da equipe.
/// Sao separadas das horas gerais (que saem do historico de situacao), para a mesma hora nao contar duas vezes.
/// </summary>
public class ProjectHourEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public Guid VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    public DateOnly Date { get; set; }
    public decimal Hours { get; set; }

    /// <summary>O que a pessoa fez (vira o "atuacao" do certificado por projeto).</summary>
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
}
