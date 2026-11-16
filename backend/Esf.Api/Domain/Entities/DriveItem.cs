namespace Esf.Api.Domain.Entities;

/// <summary>
/// Liga um programa, projeto, registro ou arquivo da plataforma ao que a plataforma criou no Google Drive do nucleo
/// (pasta ou copia). O Drive so recebe (mao unica): o que se faz direto nele nao volta para ca. Quem cria, renomeia,
/// move e apaga no Drive e a rotina em segundo plano (DriveSyncService), a partir destas linhas.
/// </summary>
public class DriveItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }

    public DriveItemKind Kind { get; set; }

    /// <summary>Id do programa, projeto, registro ou arquivo na plataforma.</summary>
    public Guid EntityId { get; set; }

    /// <summary>Complemento da chave quando um mesmo registro da plataforma gera varios itens ("" quando nao).</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Id do item no Drive (null: ainda nao criado).</summary>
    public string? DriveId { get; set; }

    /// <summary>Pasta do Drive em que o item esta e o nome que ele tem la (para saber quando mover ou renomear).</summary>
    public string? ParentDriveId { get; set; }
    public string? Name { get; set; }

    /// <summary>Projeto: subpastas em que a plataforma copia as fotos e os documentos.</summary>
    public string? PhotosFolderId { get; set; }
    public string? OtherPhotosFolderId { get; set; }
    public string? DocumentsFolderId { get; set; }

    public DriveItemState State { get; set; } = DriveItemState.Pendente;
    public int Attempts { get; set; }

    /// <summary>Depois de uma falha, so tenta de novo a partir daqui.</summary>
    public DateTime? NextAttemptAt { get; set; }

    public string? LastError { get; set; }

    /// <summary>Ate quando a rotina que pegou o item garante que segue com ele (dois servidores nao fazem o mesmo).</summary>
    public DateTime? LeaseUntil { get; set; }
    public Guid Stamp { get; set; } = Guid.NewGuid();

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Aviso de que algo mudou e o Drive precisa acompanhar, gravado no mesmo SaveChanges da mudanca (EsfDbContext). A
/// rotina do Drive transforma cada aviso num DriveItem pendente (ou descarta, se o nucleo nao ligou o Drive).
/// </summary>
public class DriveSyncRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public DriveItemKind Kind { get; set; }
    public Guid EntityId { get; set; }
    public string Key { get; set; } = string.Empty;

    /// <summary>O item sumiu da plataforma (apagar a copia no Drive).</summary>
    public bool Delete { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
