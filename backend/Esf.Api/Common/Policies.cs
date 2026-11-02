namespace Esf.Api.Common;

/// <summary>
/// Autorizacao: dois niveis de politica sobre os tres perfis de cada nucleo, mais a gestao nacional.
/// Administrador: tudo no nucleo. Coordenador: gestao de projetos e dados. Usuario: participa e atualiza execucao.
/// </summary>
public static class Policies
{
    /// <summary>Criar/editar/arquivar projetos, voluntarios e indicadores.</summary>
    public const string ManageProjects = "ManageProjects";

    /// <summary>Gestao de usuarios e dados institucionais.</summary>
    public const string AdminOnly = "AdminOnly";

    /// <summary>Gestao nacional: nucleos, indicadores nacionais e numeros consolidados (sem dados pessoais dos nucleos).</summary>
    public const string National = "National";
}
