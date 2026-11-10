namespace Esf.Api.Domain.Entities;

/// <summary>
/// Tarefa longa feita em segundo plano (relatorio em PDF, planilha). Quem pede recebe o numero na hora, a tela
/// acompanha ate ficar pronta e o resultado (arquivo ou resposta) fica guardado por alguns dias. Quem processa e o
/// JobWorker, um de cada vez, com o nucleo, o perfil e o nome de quem pediu.
/// </summary>
public class BackgroundJob : IOrganizationOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OrganizationId { get; set; }

    public BackgroundJobKind Kind { get; set; }

    public BackgroundJobStatus Status { get; set; } = BackgroundJobStatus.Queued;

    /// <summary>Quem pediu (so essa pessoa ve e baixa). Sem chave estrangeira: a limpeza apaga a tarefa depois.</summary>
    public Guid RequestedByUserId { get; set; }

    public string RequestedByName { get; set; } = string.Empty;

    /// <summary>Perfil de quem pediu, na hora do pedido: a tarefa roda com ele.</summary>
    public UserRole? RequestedByRole { get; set; }

    /// <summary>Pedido em JSON (as opcoes do relatorio, da planilha).</summary>
    public string Payload { get; set; } = "{}";

    /// <summary>Arquivo enviado junto (planilha a importar), privado; apagado quando a tarefa termina.</summary>
    public string? InputStoredName { get; set; }

    /// <summary>Resposta em JSON, quando nao e um arquivo (resultado da importacao).</summary>
    public string? Result { get; set; }

    /// <summary>Arquivo gerado (privado, so baixa quem pediu).</summary>
    public string? ResultStoredName { get; set; }

    public string? ResultFileName { get; set; }

    /// <summary>Mensagem para a tela quando falhou.</summary>
    public string? Error { get; set; }

    /// <summary>Quantas vezes comecou a ser processada (volta para a fila se o servidor reiniciar no meio).</summary>
    public int Attempts { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    /// <summary>Ate quando quem esta processando garante que segue vivo; vencido, a tarefa volta para a fila.</summary>
    public DateTime? LeaseUntil { get; set; }

    /// <summary>Ultima vez que a tela perguntou pela tarefa: se a pessoa ja saiu, o aviso vai para o sininho.</summary>
    public DateTime? LastSeenAt { get; set; }

    /// <summary>Muda sempre que alguem pega a tarefa: dois servidores nunca processam a mesma.</summary>
    public Guid Stamp { get; set; } = Guid.NewGuid();
}
