namespace Esf.Api.Common;

/// <summary>
/// Autorizacao da V0: apenas dois niveis de politica sobre os tres perfis existentes.
/// Administrador: tudo. Coordenador: gestao de projetos e dados. Usuario: participa e atualiza execucao.
/// </summary>
public static class Policies
{
    /// <summary>Criar/editar/arquivar projetos, voluntarios e indicadores.</summary>
    public const string ManageProjects = "ManageProjects";

    /// <summary>Gestao de usuarios e dados institucionais.</summary>
    public const string AdminOnly = "AdminOnly";
}
