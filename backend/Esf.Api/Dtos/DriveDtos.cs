using System.ComponentModel.DataAnnotations;

namespace Esf.Api.Dtos;

/// <summary>Configuracoes › Google Drive: como esta a ligacao do nucleo com o Drive.</summary>
public record DriveStatusDto(
    // O servidor tem a conta de servico configurada (sem ela, nao da para ligar).
    bool Available,
    // E-mail da conta da plataforma, que o nucleo adiciona ao Drive compartilhado.
    string? AccountEmail,
    // Pasta da plataforma (null: o nucleo nao ligou o Drive).
    string? FolderName,
    string? FolderUrl,
    DateTime? ConnectedAt,
    int ProjectsWithFolder,
    // Itens esperando a rotina (criar, copiar, renomear, apagar).
    int Pending,
    // Itens que pararam depois de muitas tentativas.
    int Failed,
    // Ultimo erro, para quem administra entender o que falta.
    string? LastError);

public class ConnectDriveRequest
{
    [Required(ErrorMessage = "Cole o link da pasta do Google Drive.")]
    [StringLength(500, ErrorMessage = "O link pode ter até 500 caracteres.")]
    public string FolderLink { get; set; } = string.Empty;
}
