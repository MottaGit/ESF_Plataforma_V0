namespace Esf.Api.Domain;

/// <summary>Niveis de acesso da V0. Mantidos simples de proposito.</summary>
public enum UserRole
{
    Administrador = 0,
    Coordenador = 1,
    Usuario = 2
}

public enum ProjectStatus
{
    Planejamento = 0,
    EmAndamento = 1,
    Pausado = 2,
    Concluido = 3,
    Cancelado = 4
}

public enum ActivityStatus
{
    AFazer = 0,
    EmAndamento = 1,
    Concluida = 2
}

public enum ActivityPriority
{
    Baixa = 0,
    Media = 1,
    Alta = 2
}

/// <summary>Setor interno da organizacao ao qual o voluntario pertence.</summary>
public enum VolunteerSector
{
    Projetos = 0,
    Juridico = 1,
    Pessoas = 2,
    Comunicacao = 3,
    Qualidade = 4,
    Financeiro = 5
}
