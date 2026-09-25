namespace Esf.Api.Domain.Entities;

/// <summary>
/// Programa: agrupamento de projetos (ex.: "Banheiro Direito da Gente", "Horta comunitaria").
/// Nomeado ProjectProgram (nao "Program") para nao colidir com a classe Program gerada
/// pelos top-level statements de Program.cs.
/// </summary>
public class ProjectProgram
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public ProgramStatus Status { get; set; } = ProgramStatus.Ativo;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
