/* Tipos espelhando os DTOs da API (Esf.Api/Dtos). */

export type UserRole = 'Administrador' | 'Coordenador' | 'Usuario';

export type ProjectStatus = 'Planejamento' | 'EmAndamento' | 'Pausado' | 'Concluido' | 'Cancelado';

export type ActivityStatus = 'AFazer' | 'EmAndamento' | 'Bloqueada' | 'Concluida';

export type ActivityPriority = 'Baixa' | 'Media' | 'Alta';

export type VolunteerSector = 'Projetos' | 'Juridico' | 'Pessoas' | 'Comunicacao' | 'Qualidade' | 'Financeiro';

export type VolunteerStatus = 'Ativo' | 'Inativo' | 'ExMembro' | 'Afastado';

export type ProgramStatus = 'Ativo' | 'Arquivado';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  /** Voluntario que este acesso representa. */
  volunteerId: string | null;
  volunteerName: string | null;
  /** Foto do voluntario vinculado (avatar no topo da tela). */
  volunteerPhotoUrl: string | null;
  /** Ainda nao aceitou a versao vigente da politica de privacidade e dos termos de uso. */
  termsPending: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface Program {
  id: string;
  name: string;
  status: ProgramStatus;
  createdAt: string;
  /** Quantos projetos (inclusive arquivados) pertencem ao programa. */
  projectsCount: number;
  /** Em planejamento ou em andamento (sem os arquivados). */
  activeProjectsCount: number;
  doneProjectsCount: number;
  /** Chaves de icone e cor (ver utils/programs.ts). */
  icon: string;
  color: string;
  /** Resumo do modelo do programa. */
  templateActivitiesCount: number;
  templateIndicatorsCount: number;
  hasTemplateTexts: boolean;
  /** Indicadores padrao do modelo somados nos projetos do programa. */
  results: ProgramResult[];
}

export interface ProgramResult {
  name: string;
  unit: string | null;
  total: number;
}

export interface TemplateActivity {
  id: string;
  title: string;
  description: string | null;
  priority: ActivityPriority;
  /** Prazo em dias depois do inicio do projeto; null: sem prazo. */
  dueDays: number | null;
}

export interface TemplateIndicator {
  id: string;
  name: string;
  unit: string | null;
}

/** Modelo do programa: o que um projeto novo dele ja recebe. */
export interface ProgramTemplate {
  description: string | null;
  objective: string | null;
  targetAudience: string | null;
  activities: TemplateActivity[];
  indicators: TemplateIndicator[];
}

/** O modelo inteiro; itens com id null sao novos e os que faltarem sao apagados. */
export interface SaveProgramTemplatePayload {
  description: string | null;
  objective: string | null;
  targetAudience: string | null;
  activities: Array<Omit<TemplateActivity, 'id'> & { id: string | null }>;
  indicators: Array<Omit<TemplateIndicator, 'id'> & { id: string | null }>;
}

export interface ProjectListItem {
  id: string;
  name: string;
  programId: string;
  programName: string;
  status: ProjectStatus;
  /** Calculado pela API: % de atividades concluidas (100 quando o projeto esta concluido). */
  progress: number;
  ownerVolunteerId: string | null;
  ownerName: string | null;
  district: string | null;
  city: string | null;
  startDate: string;
  endDateForecast: string | null;
  isLate: boolean;
  isArchived: boolean;
  activitiesTotal: number;
  activitiesDone: number;
  volunteersCount: number;
  updatedAt: string;
  /** Data da atualizacao de andamento mais recente (null se nunca houve). */
  lastUpdateAt: string | null;
  /** Autorizacao de uso de imagem dos beneficiarios mais recente; null quando nao foi registrada. */
  imageAuthorizedOn: string | null;
  programIcon: string;
  programColor: string;
  /** Ponto no mapa; null quando o projeto ainda nao foi marcado. */
  latitude: number | null;
  longitude: number | null;
}

export interface Activity {
  id: string;
  projectId: string;
  projectName: string | null;
  title: string;
  description: string | null;
  assignedVolunteerId: string | null;
  assignedVolunteerName: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  dueDate: string | null;
  notes: string | null;
  isLate: boolean;
  createdAt: string;
  completedAt: string | null;
  assignedVolunteerPhotoUrl: string | null;
  /** O que esta travando a atividade (so quando bloqueada). */
  blockedReason: string | null;
  programId: string | null;
  programName: string | null;
  /** Resumo do que fica dentro da atividade (cards e lista). */
  checklistTotal: number;
  checklistDone: number;
  attachmentsCount: number;
  commentsCount: number;
  /** Icone e cor do programa do projeto. */
  programIcon: string | null;
  programColor: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt: string | null;
}

/** O que fica dentro da atividade: checklist, anexos e comentarios. */
export interface ActivityDetails {
  checklist: ChecklistItem[];
  attachments: ProjectFile[];
  comments: ActivityComment[];
}

export interface Mention {
  volunteerId: string;
  name: string;
}

export interface ActivityComment {
  id: string;
  authorUserId: string | null;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  mentions: Mention[];
  createdAt: string;
  editedAt: string | null;
  /** Editar: so quem escreveu. Apagar: quem escreveu e a coordenacao. */
  canEdit: boolean;
  canDelete: boolean;
}

/** Quem pode ser mencionado com @ (tem acesso); inTeam: esta na equipe do projeto. */
export interface Mentionable {
  volunteerId: string;
  name: string;
  photoUrl: string | null;
  inTeam: boolean;
}

export interface SaveCommentPayload {
  text: string;
  mentionedVolunteerIds: string[];
}

export interface Indicator {
  id: string;
  projectId: string;
  name: string;
  unit: string | null;
  value: number;
  createdAt: string;
}

export interface VolunteerProject {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  programName: string;
  roleInProject: string | null;
}

export interface Volunteer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  skills: string | null;
  notes: string | null;
  status: VolunteerStatus;
  projects: VolunteerProject[];
  createdAt: string;
  /** Aniversario: so dia e mes (sem ano). */
  birthDay: number | null;
  birthMonth: number | null;
  /** Foto (quadrada, exibida em circulo); null quando nao ha. */
  photoUrl: string | null;
  /** Data do termo de adesao assinado mais recente; null quando esta pendente. */
  termSignedOn: string | null;
  /** Dados pessoais anonimizados (nome generico, sem contatos nem foto); so o historico continua. */
  anonymized: boolean;
}

/** Um periodo do historico de status (endsOn null: o status atual). */
export interface VolunteerStatusPeriod {
  id: string;
  status: VolunteerStatus;
  startsOn: string;
  endsOn: string | null;
}

/** Horas de voluntariado; o historico so vem para a coordenacao e para o proprio voluntario. */
export interface VolunteerHours {
  hours: number;
  weeklyHours: number;
  /** Do mais recente ao mais antigo; null quando a pessoa logada nao pode ver. */
  history: VolunteerStatusPeriod[] | null;
}

export interface SaveStatusPeriodPayload {
  status: VolunteerStatus;
  startsOn: string;
  /** null: continua ate hoje. */
  endsOn: string | null;
}

export interface ProjectVolunteer {
  volunteerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  roleInProject: string | null;
  joinedAt: string;
  photoUrl: string | null;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  text: string;
  authorUserId: string | null;
  /** Nome do voluntario vinculado ao autor (ou do usuario, sem vinculo). */
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
  attachments: ProjectFile[];
  authorPhotoUrl: string | null;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description: string | null;
  url: string;
  isImage: boolean;
  uploadedByName: string | null;
  uploadedAt: string;
  /** Preenchidos quando o arquivo foi anexado a uma atualizacao de andamento. */
  projectUpdateId: string | null;
  updateCreatedAt: string | null;
  /** Preenchidos quando o arquivo foi anexado numa atividade. */
  activityId: string | null;
  activityTitle: string | null;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  programId: string;
  programName: string;
  status: ProjectStatus;
  /** Calculado pela API: % de atividades concluidas (100 quando o projeto esta concluido). */
  progress: number;
  ownerVolunteerId: string | null;
  ownerName: string | null;
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
  isLate: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
  volunteers: ProjectVolunteer[];
  indicators: Indicator[];
  files: ProjectFile[];
  updates: ProjectUpdate[];
  /** Autorizacao de uso de imagem dos beneficiarios mais recente; null quando nao foi registrada. */
  imageAuthorizedOn: string | null;
  programIcon: string;
  programColor: string;
}

export interface VolunteerWorkload {
  volunteerId: string;
  name: string;
  photoUrl: string | null;
  openActivities: number;
  lateActivities: number;
}

/** Numeros do usuario logado (so quando o acesso esta vinculado a um voluntario). */
export interface MyActivities {
  open: number;
  late: number;
  blocked: number;
}

/** Um projeto da pessoa logada no Inicio. */
export interface HomeProject {
  id: string;
  name: string;
  programIcon: string;
  programColor: string;
  status: ProjectStatus;
  progress: number;
  /** Ultimo relato de andamento (null: nunca houve). */
  lastUpdateAt: string | null;
}

/** Resumo da organizacao (mostrado para a coordenacao). */
export interface OrgSummary {
  lateTasks: number;
  blockedTasks: number;
  unassignedTasks: number;
  /** Projetos em andamento sem relato ha mais de 30 dias. */
  staleProjects: number;
}

/** Tela Inicio. */
export interface Dashboard {
  mine: MyActivities | null;
  /** Tarefas em aberto da pessoa logada (vazio sem voluntario vinculado). */
  myTasks: Activity[];
  myProjects: HomeProject[];
  org: OrgSummary;
  workload: VolunteerWorkload[];
}

export type SignedDocumentKind = 'VolunteerTerm' | 'BeneficiaryImageAuthorization';

/** Termo de adesao ou autorizacao de uso de imagem assinado (so a coordenacao ve). */
export interface SignedDocument {
  id: string;
  kind: SignedDocumentKind;
  fileName: string;
  sizeBytes: number;
  signedOn: string;
  uploadedAt: string;
  uploadedByName: string | null;
}

/** O que gerou o aviso do sininho. */
export type NotificationType =
  | 'ActivityAssigned'
  | 'ActivityBlocked'
  | 'ActivityCompleted'
  | 'ActivityReopened'
  | 'AddedToTeam'
  | 'ProjectOwner'
  | 'ActivityDueTomorrow'
  | 'ActivityDueToday'
  | 'CommentMention'
  | 'ActivityCommented';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  /** Linha de apoio, normalmente o nome do projeto. */
  context: string | null;
  projectId: string | null;
  activityId: string | null;
  createdAt: string;
  read: boolean;
}

/** linked=false: o acesso nao esta vinculado a um voluntario (sem avisos). */
export interface NotificationList {
  linked: boolean;
  unreadCount: number;
  items: AppNotification[];
}

export interface UnreadNotifications {
  linked: boolean;
  count: number;
}

export interface Organization {
  id: string;
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
  logoUrl: string | null;
  updatedAt: string;
  /** Quem assina pela organizacao nos termos e certificados. */
  signatoryName: string | null;
  signatoryRole: string | null;
  /** Linha abaixo do cargo no certificado (ex.: Gestao 2025). */
  signatoryNote: string | null;
  /** Ha imagem de assinatura para os certificados (o arquivo e privado). */
  hasSignature: boolean;
}

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
  notes: string | null;
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
}

export interface SaveIndicatorPayload {
  name: string;
  unit: string | null;
  value: number;
}

export interface SaveUserPayload {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  volunteerId: string | null;
  password?: string;
  newPassword?: string;
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
export interface CertificatePayload {
  startDate: string;
  endDate: string;
  weeklyHours: number;
  cpf: string | null;
}

export interface ReportPayload {
  projectIds: string[];
  includeVolunteers: boolean;
  includeIndicators: boolean;
  includeUpdates: boolean;
  includePhotos: boolean;
  note: string | null;
}

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | '';
  programId?: string;
  ownerVolunteerId?: string;
  onlyLate?: boolean;
  /** So os parados (em andamento, sem relato ha mais de 30 dias). */
  onlyStale?: boolean;
  includeArchived?: boolean;
  sort?: string;
}

/* ---------- historico de alteracoes ---------- */

export type AuditAction = 'Created' | 'Updated' | 'Deleted';

export interface AuditChange {
  field: string;
  before: string;
  after: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string | null;
  userName: string;
  action: AuditAction;
  /** Tipo do registro, em portugues (Projeto, Atividade, Voluntario...). */
  entityType: string;
  entityId: string;
  entityLabel: string;
  projectId: string | null;
  projectName: string | null;
  changes: AuditChange[];
}

export interface AuditPage {
  items: AuditEntry[];
  hasMore: boolean;
}

export interface AuditFilters {
  projectId?: string;
  userId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Busca geral do topo: poucos resultados de cada tipo. */
export interface SearchResults {
  projects: Array<{
    id: string;
    name: string;
    programName: string;
    programIcon: string;
    programColor: string;
    status: ProjectStatus;
    isArchived: boolean;
  }>;
  programs: Array<{ id: string; name: string; icon: string; color: string; isArchived: boolean }>;
  activities: Array<{ id: string; title: string; projectId: string; projectName: string; status: ActivityStatus }>;
  volunteers: Array<{ id: string; name: string; sector: VolunteerSector; photoUrl: string | null }>;
  /** Relatos: trecho do texto em volta do termo. */
  updates: Array<{ id: string; projectId: string; projectName: string; createdAt: string; snippet: string }>;
}
