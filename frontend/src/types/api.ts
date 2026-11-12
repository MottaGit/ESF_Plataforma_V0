/*
 * Tipos da API com os nomes usados nas telas. O que a API devolve vem do contrato gerado (openapi.ts, a partir dos
 * DTOs do backend: os campos e o que cada um quer dizer estao em backend/Esf.Api/Dtos); escritos a mao aqui ficam so o
 * que a tela envia (Save...Payload), os filtros e o que a API devolve fora do contrato (resultado da importacao de
 * planilha, que vem em JSON dentro da tarefa).
 */
import type * as G from './openapi';

export type UserRole = G.UserRole;

export type ProjectStatus = G.ProjectStatus;

export type ActivityStatus = G.ActivityStatus;

/** Na tela, Alta e "Urgente" e o resto e normal (Baixa nao e mais usada). */
export type ActivityPriority = G.ActivityPriority;

export type VolunteerSector = G.VolunteerSector;

export type VolunteerStatus = G.VolunteerStatus;

export type ProgramStatus = G.ProgramStatus;

export type User = G.UserDto;

/** Um nucleo na gestao nacional: dados basicos, numeros gerais e quem administra. */
export type Nucleo = G.NucleoDto;

export type NucleoAdmin = G.NucleoAdminDto;

/** Nucleo criado ou administrador incluido: o link de primeiro acesso (null quando a pessoa ja tinha acesso). */
export type NucleoAdminResult = G.NucleoAdminResultDto;

export interface SaveNucleoPayload {
  name: string;
  city: string | null;
  state: string | null;
  adminName?: string;
  adminEmail?: string;
}

/**
 * Indicador somado pela regra unica (visao do programa, PDF, pagina publica, painel nacional): so os valores
 * informados. total null: nenhum projeto informou (nao e zero); informed de projects projetos informaram.
 */
export interface SummedValue {
  total: number | null;
  informed: number;
  projects: number;
}

/**
 * Painel nacional: numeros de todos os nucleos, sem dados pessoais. Tarefas, registros e horas valem no periodo;
 * projetos, voluntarios ativos e indicadores sao a situacao de hoje. Projetos ativos: em planejamento, em andamento ou
 * pausados; concluidos e indicadores contam tambem os arquivados. volunteerHours e a estimativa (6 h/semana).
 */
export type NationalPanel = G.NationalPanelDto;

export type NationalPanelRow = G.NationalNucleoRowDto;

/** Quem faz parte da gestao nacional (conta so nacional ou acesso de alguem de um nucleo). */
export type NationalPerson = G.NationalPersonDto;

export type NationalPersonResult = G.NationalPersonResultDto;

export type LoginResponse = G.LoginResponse;

/** Link de acesso recem-gerado: o codigo so volta nesta resposta. */
export type AccessLink = G.AccessLinkDto;

/** O que a pagina publica do link mostra antes de a pessoa criar a senha. */
export type AccessLinkInfo = G.AccessLinkInfoDto;

export type Program = G.ProgramDto;

/** Parceiro do programa. Nome e papel aparecem na pagina publica e no PDF; contato e observacoes, so no nucleo. */
export type ProgramPartner = G.ProgramPartnerDto;

/** A lista inteira; itens com id null sao novos e os que faltarem sao apagados. */
export interface SaveProgramPartnersPayload {
  partners: Array<Omit<ProgramPartner, 'id'> & { id: string | null }>;
}

/** Pagina publica do programa, como a coordenacao configura (o codigo so vem com ela ligada). */
export type ProgramPublicPage = G.ProgramPublicPageDto;

/**
 * Pagina publica do programa (sem login): so os dados liberados. Nada de endereco, pessoas, tarefas, registros, fotos
 * ou arquivos.
 */
export type PublicProgram = G.PublicProgramDto;

export type PublicNucleo = G.PublicNucleoDto;

export type PublicPartner = G.PublicPartnerDto;

export type PublicProgramTotals = G.PublicProgramTotalsDto;

export type PublicIndicator = G.PublicIndicatorDto;

export type PublicProject = G.PublicProjectDto;

export type ProgramResult = G.ProgramResultDto;

export type TemplateActivity = G.TemplateActivityDto;

export type TemplateIndicator = G.TemplateIndicatorDto;

/** Indicador nacional: definido pela gestao nacional; os nucleos escolhem nos projetos e nos modelos. */
export type NationalIndicator = G.NationalIndicatorDto;

export interface SaveNationalIndicatorPayload {
  name: string;
  unit: string | null;
  description: string | null;
}

/** Modelo de projeto: as tarefas e os indicadores que um projeto novo do programa ja recebe. */
export type ProgramTemplate = G.ProgramTemplateDto;

/** O modelo inteiro; itens com id null sao novos e os que faltarem sao apagados. */
export interface SaveProgramTemplatePayload {
  activities: Array<Omit<TemplateActivity, 'id'> & { id: string | null }>;
  indicators: Array<Omit<TemplateIndicator, 'id'> & { id: string | null }>;
}

export type ProjectListItem = G.ProjectListItemDto;

export type Activity = G.ActivityDto;

export type ChecklistItem = G.ChecklistItemDto;

/** O que fica dentro da atividade: checklist, anexos e comentarios. */
export type ActivityDetails = G.ActivityDetailsDto;

export type Mention = G.MentionDto;

export type ActivityComment = G.CommentDto;

/** Quem pode ser mencionado com @ (tem acesso); inTeam: esta na equipe do projeto. */
export type Mentionable = G.MentionableDto;

export interface SaveCommentPayload {
  text: string;
  mentionedVolunteerIds: string[];
}

export type Indicator = G.IndicatorDto;

export type VolunteerProject = G.VolunteerProjectDto;

export type Volunteer = G.VolunteerDto;

/** Acesso de um voluntario: perfil, se esta ativo e se ainda espera o primeiro acesso (sem senha). */
export type VolunteerAccess = G.VolunteerAccessDto;

/** Um periodo do historico de status (endsOn null: o status atual). */
export type VolunteerStatusPeriod = G.VolunteerStatusPeriodDto;

/** Horas de voluntariado; o historico so vem para a coordenacao e para o proprio voluntario. */
export type VolunteerHours = G.VolunteerHoursDto;

export interface SaveStatusPeriodPayload {
  status: VolunteerStatus;
  startsOn: string;
  /** null: continua ate hoje. */
  endsOn: string | null;
}

/** Situacao e tarefas em aberto (projetos em planejamento ou andamento), para escolher o responsavel. */
export type VolunteerLoad = G.VolunteerLoadDto;

export type WeekDay = G.WeekDay;

/** Turno do dia: na grade de disponibilidade e no horario da visita. */
export type Shift = G.Shift;

export type TransportMode = G.TransportMode;

export type AvailabilitySlot = G.AvailabilitySlotDto;

/** Bairro, deslocamento e turnos livres (so a coordenacao e a propria pessoa veem). */
export type VolunteerAvailability = G.VolunteerAvailabilityDto;

export interface SaveAvailabilityPayload {
  district: string | null;
  city: string | null;
  /** Centro aproximado do bairro, achado no mapa pelo navegador (null: nao achado). */
  latitude: number | null;
  longitude: number | null;
  transport: TransportMode | null;
  slots: AvailabilitySlot[];
}

export type ProjectVolunteer = G.ProjectVolunteerDto;

export type ProjectUpdate = G.ProjectUpdateDto;

/** Uma pagina dos registros de um projeto (do mais recente para o mais antigo) e quantos ele tem ao todo. */
export type ProjectUpdatePage = G.ProjectUpdatePageDto;

export type ProjectFile = G.ProjectFileDto;

export type ProjectDetail = G.ProjectDetailDto;

/** Voluntario ativo sem nenhuma tarefa em aberto (Inicio da coordenacao). */
export type IdleVolunteer = G.IdleVolunteerDto;

/** Numeros do usuario logado (so quando o acesso esta vinculado a um voluntario). */
export type MyActivities = G.MyActivitiesDto;

/** Um projeto da pessoa logada no Inicio. */
export type HomeProject = G.HomeProjectDto;

/** Resumo da organizacao (mostrado para a coordenacao). */
export type OrgSummary = G.OrgSummaryDto;

/** Tela Inicio. */
export type Dashboard = G.DashboardDto;

/** Primeiros passos do nucleo novo; o ultimo (o primeiro projeto) fecha o quadro. */
export type SetupStatus = G.SetupDto;

export type SignedDocumentKind = G.SignedDocumentKind;

/** Termo de adesao ou autorizacao de uso de imagem assinado (so a coordenacao ve). */
export type SignedDocument = G.SignedDocumentDto;

/** Texto do termo de adesao (o mesmo do PDF). */
export type VolunteerTermText = G.VolunteerTermText;

/** Termo de adesao do voluntario logado. */
export type MyTerm = G.MyTermDto;

export interface SignTermPayload {
  fullName: string;
  cpf: string;
  imageAuthorized: boolean | null;
  accepted: boolean;
}

/** O que gerou o aviso do sininho. */
export type NotificationType = G.NotificationType;

export type AppNotification = G.NotificationDto;

/** linked=false: o acesso nao esta vinculado a um voluntario (sem avisos). */
export type NotificationList = G.NotificationsDto;

export type UnreadNotifications = G.UnreadNotificationsDto;

export type Organization = G.OrganizationDto;

/* ---------- payloads de escrita ---------- */

export interface SaveProjectPayload {
  name: string;
  description: string | null;
  programId: string;
  ownerVolunteerId: string | null;
  objective: string | null;
  beneficiaries: string | null;
  targetAudience: string | null;
  notes: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDateForecast: string | null;
  status: ProjectStatus;
  /** Dia em que foi concluido ou cancelado (so vale para esses dois status). */
  closedOn?: string | null;
  /** So na criacao: usa o modelo do programa. */
  useTemplate?: boolean;
}

export interface SaveActivityPayload {
  title: string;
  description: string | null;
  assignedVolunteerId: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  dueDate: string | null;
  blockedReason: string | null;
}

export interface SaveVolunteerPayload {
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  skills: string | null;
  notes: string | null;
  status: VolunteerStatus;
  birthDay: number | null;
  birthMonth: number | null;
  /** So no cadastro novo: desde quando esta no nucleo (vazio: hoje). */
  activeSince?: string | null;
  /** Saindo do nucleo (Inativo ou Ex-membro): desativa tambem o acesso. */
  deactivateAccess?: boolean;
  /** Saindo do nucleo (Inativo ou Ex-membro): as tarefas em aberto ficam sem responsavel. */
  releaseTasks?: boolean;
}

export interface SaveProgramPayload {
  name: string;
  icon: string;
  color: string;
}

export interface UpdateProgramPayload {
  name: string;
  status: ProgramStatus;
  icon: string;
  color: string;
  /** Ficha do programa (null apaga): sempre os tres textos atuais. */
  description: string | null;
  objective: string | null;
  audience: string | null;
}

export interface SaveIndicatorPayload {
  name: string;
  unit: string | null;
  /** null: ainda nao informado. */
  value: number | null;
  /** Indicador nacional: nome e unidade passam a vir dele. */
  nationalIndicatorId: string | null;
}

/** Edicao de um acesso: nome e e-mail vem do cadastro do voluntario. */
export interface SaveUserPayload {
  role: UserRole;
  isActive: boolean;
  /** So para acesso antigo, sem voluntario: liga ao cadastro. */
  volunteerId: string | null;
}

export interface SaveOrganizationPayload {
  name: string;
  legalName: string | null;
  cnpj: string | null;
  mission: string | null;
  about: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  signatoryName: string | null;
  signatoryRole: string | null;
  signatoryNote: string | null;
}

/** Certificado de voluntariado: periodo e carga semanal; o CPF so vai para o PDF. */
/** Periodo completo (do historico), periodo especifico ou por projeto. */
export type CertificateKind = G.CertificateKind;

export interface CertificatePayload {
  kind: CertificateKind;
  /** Periodo escolhido ou do projeto (no periodo completo, vem do historico). */
  startDate: string | null;
  endDate: string | null;
  weeklyHours: number;
  cpf: string | null;
  projectId: string | null;
  projectSummary: string | null;
  activities: string | null;
  /** Por projeto: inclui as horas lancadas no periodo. */
  includeHours: boolean;
}

/** O que a janela do certificado ja mostra preenchido. */
export type CertificateOptions = G.CertificateOptionsDto;

/** Resumo: so os numeros somados e a tabela dos projetos. Completo: mais um capitulo por projeto. */
export type ReportFormat = G.ReportFormat;

export interface ReportPayload {
  projectIds: string[];
  format: ReportFormat;
  includeVolunteers: boolean;
  includeIndicators: boolean;
  includeUpdates: boolean;
  includePhotos: boolean;
  includeTasks: boolean;
  /** Periodo de referencia (aaaa-mm-dd); null numa ponta deixa aquele lado aberto. */
  from: string | null;
  to: string | null;
  note: string | null;
}

/** O que um projeto tem no periodo do relatorio: registros, fotos que entram no PDF e tarefas concluidas. */
export type ReportPeriodCount = G.ReportPeriodCountDto;

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | '';
  programId?: string;
  ownerVolunteerId?: string;
  /** "Meus projetos": responsavel ou na equipe. */
  memberVolunteerId?: string;
  onlyLate?: boolean;
  /** So os parados (em andamento, sem relato ha mais de 30 dias). */
  onlyStale?: boolean;
  includeArchived?: boolean;
  sort?: string;
}

/* ---------- historico de alteracoes ---------- */

/** Exported: alguem exportou a planilha (fica no historico porque leva dados pessoais). */
export type AuditAction = G.AuditAction;

export type AuditChange = G.AuditChange;

export type AuditEntry = G.AuditEntryDto;

export type AuditPage = G.AuditPageDto;

export interface AuditFilters {
  projectId?: string;
  userId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Busca geral do topo: poucos resultados de cada tipo. */
export type SearchResults = G.SearchResultsDto;

// ---------- planilha (exportar e importar) ----------

/** O que entra na planilha exportada (ao menos um). */
export interface ExportSpreadsheetPayload {
  /** Aba Projetos, com o resumo dos programas. */
  projects: boolean;
  /** Aba Voluntarios (dados pessoais). */
  volunteers: boolean;
}

/** New: vai ser criado; Existing: ja esta na plataforma (ignorado); Error: nao entra. */
export type ImportRowResult = 'New' | 'Existing' | 'Error';

export interface ImportRow {
  /** Numero da linha no Excel. */
  row: number;
  label: string;
  detail: string | null;
  result: ImportRowResult;
  errors: string[];
  warnings: string[];
}

export interface ImportSheet {
  new: number;
  existing: number;
  errors: number;
  rows: ImportRow[];
}

/** Conferencia (applied = false) ou o que foi gravado (applied = true); aba ausente no arquivo vem null. */
export interface ImportResult {
  sourceNucleo: string | null;
  fileWarnings: string[];
  projects: ImportSheet | null;
  volunteers: ImportSheet | null;
  newPrograms: Array<{ name: string; archived: boolean }>;
  applied: boolean;
}

/** Um lancamento de horas num projeto. */
export type ProjectHourEntry = G.ProjectHourEntryDto;

/** Horas lancadas num projeto: total, por pessoa e os lancamentos (mais novos primeiro). */
export type ProjectHours = G.ProjectHoursDto;

export interface SaveHourEntryPayload {
  /** Vazio: as horas sao de quem esta logado. */
  volunteerId: string | null;
  date: string;
  hours: number;
  description: string | null;
}

/** Tarefa longa feita em segundo plano no servidor (relatório, planilha). */
export type BackgroundJobKind = G.BackgroundJobKind;

export type BackgroundJobStatus = G.BackgroundJobStatus;

export type BackgroundJob = G.BackgroundJobDto;
