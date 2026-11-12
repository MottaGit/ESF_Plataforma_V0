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
    Concluida = 2,
    // Parada por algum impedimento (o motivo fica em Activity.BlockedReason). Continua em aberto.
    Bloqueada = 3
}

/// <summary>Prioridade da tarefa: na tela, Alta e "Urgente" e o resto e normal (Baixa nao e mais usada).</summary>
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

public enum VolunteerStatus
{
    Ativo = 0,
    Inativo = 1,
    ExMembro = 2,
    Afastado = 3
}

/// <summary>Situacao de um Programa (agrupamento de projetos, ex.: "Banheiro Direito da Gente").</summary>
public enum ProgramStatus
{
    Ativo = 0,
    Arquivado = 1
}

/// <summary>O que gerou um aviso para o voluntario (sininho no topo da tela).</summary>
public enum NotificationType
{
    ActivityAssigned = 0,
    ActivityBlocked = 1,
    ActivityCompleted = 2,
    ActivityReopened = 3,
    AddedToTeam = 4,
    ProjectOwner = 5,
    ActivityDueTomorrow = 6,
    ActivityDueToday = 7,
    CommentMention = 8,
    ActivityCommented = 9,

    /// <summary>Relatorio pedido em segundo plano terminou (pronto ou com erro) quando a pessoa ja tinha saido da tela.</summary>
    ReportFinished = 10,

    /// <summary>Planilha (exportacao ou importacao) terminou quando a pessoa ja tinha saido da tela.</summary>
    SpreadsheetFinished = 11
}

/// <summary>Miniatura e versao do PDF de uma foto (ver Reports/ImagePreviews), geradas em segundo plano.</summary>
public enum PreviewState
{
    /// <summary>Nao e foto, ou e um formato sem versoes (documento, GIF, HEIC).</summary>
    None = 0,
    Pending = 1,
    Ready = 2,
    /// <summary>A imagem nao pode ser lida: as telas e o PDF usam a original.</summary>
    Failed = 3
}

/// <summary>Tarefa longa feita em segundo plano (ver BackgroundJob).</summary>
public enum BackgroundJobKind
{
    Report = 0,
    SpreadsheetExport = 1,
    SpreadsheetImport = 2
}

public enum BackgroundJobStatus
{
    Queued = 0,
    Running = 1,
    Done = 2,
    Failed = 3
}

/// <summary>Documentos assinados guardados na plataforma.</summary>
public enum SignedDocumentKind
{
    /// <summary>Termo de adesao ao servico voluntario, com a autorizacao de uso de imagem do voluntario.</summary>
    VolunteerTerm = 0,

    /// <summary>Autorizacao de uso de imagem dos beneficiarios de um projeto.</summary>
    BeneficiaryImageAuthorization = 1
}

/// <summary>Tipo da tarefa: a visita tem dia, turno e sempre duas pessoas (responsavel e acompanhante).</summary>
public enum ActivityKind
{
    Tarefa = 0,
    Visita = 1
}

/// <summary>Dia da semana na grade de disponibilidade (comeca na segunda, como a grade da tela).</summary>
public enum WeekDay
{
    Segunda = 0,
    Terca = 1,
    Quarta = 2,
    Quinta = 3,
    Sexta = 4,
    Sabado = 5,
    Domingo = 6
}

/// <summary>Turno do dia: na grade de disponibilidade e no horario da visita.</summary>
public enum Shift
{
    Manha = 0,
    Tarde = 1,
    Noite = 2
}

/// <summary>Como o turno da visita fica para a pessoa, pela grade de disponibilidade dela.</summary>
public enum VisitAvailability
{
    /// <summary>Marcou o turno como livre.</summary>
    Livre = 0,
    /// <summary>Nunca preencheu a grade.</summary>
    NaoInformou = 1,
    /// <summary>Preencheu a grade sem esse turno.</summary>
    Ocupado = 2
}

/// <summary>Como o voluntario costuma se deslocar ate as obras.</summary>
public enum TransportMode
{
    Carro = 0,
    TransportePublico = 1
}

/// <summary>O que aconteceu com o registro, no historico de alteracoes.</summary>
public enum AuditAction
{
    Created = 0,
    Updated = 1,
    Deleted = 2,
    /// <summary>Exportou dados (planilha): fica no historico porque leva dados pessoais.</summary>
    Exported = 3
}
