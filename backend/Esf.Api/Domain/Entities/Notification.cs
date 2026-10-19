namespace Esf.Api.Domain.Entities;

/// <summary>
/// Aviso para um voluntario (quem usa o acesso vinculado a ele ve no sininho). O texto fica pronto no
/// momento em que o aviso nasce; projeto e atividade servem para o link.
/// </summary>
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Quem recebe o aviso.</summary>
    public Guid VolunteerId { get; set; }
    public Volunteer? Volunteer { get; set; }

    public NotificationType Type { get; set; }

    /// <summary>Ex.: Leonardo atribuiu a voce "Comprar cimento".</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Linha de apoio, normalmente o nome do projeto.</summary>
    public string? Context { get; set; }

    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public Guid? ActivityId { get; set; }
    public Activity? Activity { get; set; }

    /// <summary>Usuario que fez a acao (vazio nos lembretes de prazo).</summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>Identifica lembretes de prazo para nao gerar o mesmo aviso duas vezes.</summary>
    public string? Key { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
