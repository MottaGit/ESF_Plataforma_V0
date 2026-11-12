// Gerado por scripts/openapi-types.mjs a partir de openapi.json (o contrato da API). Nao edite a mao: depois de
// mudar um DTO, rode no backend `ESF_UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests` e aqui
// `npm run types`. Os nomes sao os dos DTOs do backend; types/api.ts da os nomes usados nas telas.

export interface AccessLinkDto {
  userId: string;
  token: string;
  expiresAt: string;
}

export interface AccessLinkInfoDto {
  name: string;
  email: string;
  firstAccess: boolean;
}

export interface ActivityDetailsDto {
  checklist: ChecklistItemDto[];
  attachments: ProjectFileDto[];
  comments: CommentDto[];
}

export interface ActivityDto {
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
  isLate: boolean;
  createdAt: string;
  completedAt: string | null;
  assignedVolunteerPhotoUrl: string | null;
  blockedReason: string | null;
  programId: string | null;
  programName: string | null;
  checklistTotal: number;
  checklistDone: number;
  attachmentsCount: number;
  commentsCount: number;
  programIcon: string | null;
  programColor: string | null;
}

export type ActivityPriority = 'Baixa' | 'Media' | 'Alta';

export type ActivityStatus = 'AFazer' | 'EmAndamento' | 'Concluida' | 'Bloqueada';

export interface AddProjectVolunteerRequest {
  volunteerId: string;
  roleInProject: string | null;
}

export type AuditAction = 'Created' | 'Updated' | 'Deleted' | 'Exported';

export interface AuditChange {
  field: string;
  before: string;
  after: string;
}

export interface AuditEntryDto {
  id: string;
  at: string;
  userId: string | null;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  projectId: string | null;
  projectName: string | null;
  changes: AuditChange[];
}

export interface AuditPageDto {
  items: AuditEntryDto[];
  hasMore: boolean;
}

export interface AvailabilitySlotDto {
  day: WeekDay;
  shift: Shift;
}

export interface BackgroundJobDto {
  id: string;
  kind: BackgroundJobKind;
  status: BackgroundJobStatus;
  ahead: number | null;
  fileName: string | null;
  error: string | null;
  result: unknown | null;
  createdAt: string;
  finishedAt: string | null;
}

export type BackgroundJobKind = 'Report' | 'SpreadsheetExport' | 'SpreadsheetImport';

export type BackgroundJobStatus = 'Queued' | 'Running' | 'Done' | 'Failed';

export interface CertificateFullPeriodDto {
  start: string;
  end: string;
  hours: number;
  weeklyHours: number;
}

export type CertificateKind = 'Period' | 'Full' | 'Project';

export interface CertificateOptionsDto {
  full: CertificateFullPeriodDto | null;
  projects: CertificateProjectDto[];
}

export interface CertificateProjectDto {
  projectId: string;
  name: string;
  programName: string;
  status: ProjectStatus;
  start: string;
  end: string;
  hours: number;
  summary: string | null;
  activities: string | null;
}

export interface CertificateRequest {
  kind: CertificateKind;
  startDate: string | null;
  endDate: string | null;
  weeklyHours: number;
  cpf: string | null;
  projectId: string | null;
  projectSummary: string | null;
  activities: string | null;
  includeHours: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChecklistItemDto {
  id: string;
  text: string;
  done: boolean;
  doneAt: string | null;
}

export interface CommentDto {
  id: string;
  authorUserId: string | null;
  authorName: string;
  authorPhotoUrl: string | null;
  text: string;
  mentions: MentionDto[];
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CreateNucleoRequest {
  name: string;
  city: string | null;
  state: string | null;
  adminName: string;
  adminEmail: string;
}

export interface DashboardDto {
  mine: MyActivitiesDto | null;
  myTasks: ActivityDto[];
  myProjects: HomeProjectDto[];
  org: OrgSummaryDto;
  idle: IdleVolunteerDto[];
  setup: SetupDto | null;
}

export interface ExportSpreadsheetRequest {
  projects: boolean;
  volunteers: boolean;
}

export interface GrantAccessRequest {
  role: UserRole;
}

export interface HomeProjectDto {
  id: string;
  name: string;
  programIcon: string;
  programColor: string;
  status: ProjectStatus;
  progress: number;
  lastUpdateAt: string | null;
  tasks: number;
}

export interface IdleVolunteerDto {
  volunteerId: string;
  name: string;
  photoUrl: string | null;
  projects: number;
}

export interface IndicatorDto {
  id: string;
  projectId: string;
  name: string;
  unit: string | null;
  value: number | null;
  createdAt: string;
  nationalIndicatorId: string | null;
  valueUpdatedAt: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface MentionDto {
  volunteerId: string;
  name: string;
}

export interface MentionableDto {
  volunteerId: string;
  name: string;
  photoUrl: string | null;
  inTeam: boolean;
}

export interface MyActivitiesDto {
  open: number;
  late: number;
  blocked: number;
}

export interface MyTermDto {
  volunteerName: string;
  email: string | null;
  phone: string | null;
  pending: boolean;
  signed: MyTermSignedDto | null;
  text: VolunteerTermText;
}

export interface MyTermSignedDto {
  signedOn: string;
  signedAt: string | null;
  signedOnline: boolean;
  imageAuthorized: boolean | null;
}

export interface NationalIndicatorDto {
  id: string;
  name: string;
  unit: string | null;
  description: string | null;
  isArchived: boolean;
}

export interface NationalIndicatorTotalDto {
  id: string;
  name: string;
  unit: string | null;
  total: number | null;
  informed: number;
  projects: number;
}

export interface NationalIndicatorValueDto {
  total: number | null;
  informed: number;
  projects: number;
}

export interface NationalNucleoRowDto {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  activeProjects: number;
  concludedProjects: number;
  activeVolunteers: number;
  volunteerHours: number;
  tasksCompleted: number;
  records: number;
  lastActivityAt: string | null;
  indicators: Record<string, NationalIndicatorValueDto>;
}

export interface NationalPanelDto {
  from: string | null;
  to: string | null;
  totals: NationalTotalsDto;
  indicators: NationalIndicatorTotalDto[];
  nucleos: NationalNucleoRowDto[];
}

export interface NationalPersonDto {
  userId: string;
  name: string;
  email: string;
  nucleoName: string | null;
  pending: boolean;
  isActive: boolean;
  isMe: boolean;
}

export interface NationalPersonResultDto {
  person: NationalPersonDto;
  link: AccessLinkDto | null;
}

export interface NationalTotalsDto {
  nucleos: number;
  activeProjects: number;
  concludedProjects: number;
  activeVolunteers: number;
  volunteerHours: number;
  tasksCompleted: number;
  records: number;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  message: string;
  context: string | null;
  projectId: string | null;
  activityId: string | null;
  createdAt: string;
  read: boolean;
}

export type NotificationType = 'ActivityAssigned' | 'ActivityBlocked' | 'ActivityCompleted' | 'ActivityReopened' | 'AddedToTeam' | 'ProjectOwner' | 'ActivityDueTomorrow' | 'ActivityDueToday' | 'CommentMention' | 'ActivityCommented' | 'ReportFinished' | 'SpreadsheetFinished';

export interface NotificationsDto {
  linked: boolean;
  unreadCount: number;
  items: NotificationDto[];
}

export interface NucleoAdminDto {
  userId: string;
  name: string;
  email: string;
  pending: boolean;
  isActive: boolean;
}

export interface NucleoAdminResultDto {
  nucleo: NucleoDto;
  link: AccessLinkDto | null;
}

export interface NucleoDto {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  activeVolunteers: number;
  activeProjects: number;
  admins: NucleoAdminDto[];
}

export interface OrgSummaryDto {
  lateTasks: number;
  blockedTasks: number;
  staleProjects: number;
}

export interface OrganizationDto {
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
  signatoryName: string | null;
  signatoryRole: string | null;
  signatoryNote: string | null;
  hasSignature: boolean;
}

export interface PersonHoursDto {
  volunteerId: string;
  name: string;
  hours: number;
}

export interface PersonRequest {
  name: string;
  email: string;
}

export interface ProgramDto {
  id: string;
  name: string;
  status: ProgramStatus;
  createdAt: string;
  projectsCount: number;
  activeProjectsCount: number;
  doneProjectsCount: number;
  icon: string;
  color: string;
  description: string | null;
  objective: string | null;
  audience: string | null;
  templateActivitiesCount: number;
  templateIndicatorsCount: number;
  publicPage: boolean;
  partners: string[];
  results: ProgramResultDto[];
}

export interface ProgramPartnerDto {
  id: string;
  name: string;
  role: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface ProgramPublicPageDto {
  enabled: boolean;
  token: string | null;
}

export interface ProgramResultDto {
  name: string;
  unit: string | null;
  total: number | null;
  informed: number;
  projects: number;
  national: boolean;
  target: number | null;
}

export type ProgramStatus = 'Ativo' | 'Arquivado';

export interface ProgramTemplateDto {
  activities: TemplateActivityDto[];
  indicators: TemplateIndicatorDto[];
}

export interface ProjectDetailDto {
  id: string;
  name: string;
  description: string | null;
  programId: string;
  programName: string;
  status: ProjectStatus;
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
  activities: ActivityDto[];
  volunteers: ProjectVolunteerDto[];
  indicators: IndicatorDto[];
  updatesCount: number;
  filesCount: number;
  imageAuthorizedOn: string | null;
  programIcon: string;
  programColor: string;
  closedOn: string | null;
  progress: number;
}

export interface ProjectFileDto {
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
  projectUpdateId: string | null;
  updateCreatedAt: string | null;
  activityId: string | null;
  activityTitle: string | null;
  thumbnailUrl: string | null;
}

export interface ProjectHourEntryDto {
  id: string;
  volunteerId: string;
  volunteerName: string;
  photoUrl: string | null;
  date: string;
  hours: number;
  description: string | null;
  canEdit: boolean;
}

export interface ProjectHoursDto {
  total: number;
  people: PersonHoursDto[];
  entries: ProjectHourEntryDto[];
}

export interface ProjectListItemDto {
  id: string;
  name: string;
  programId: string;
  programName: string;
  status: ProjectStatus;
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
  lastUpdateAt: string | null;
  imageAuthorizedOn: string | null;
  programIcon: string;
  programColor: string;
  latitude: number | null;
  longitude: number | null;
  progress: number;
}

export type ProjectStatus = 'Planejamento' | 'EmAndamento' | 'Pausado' | 'Concluido' | 'Cancelado';

export interface ProjectUpdateDto {
  id: string;
  projectId: string;
  text: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
  attachments: ProjectFileDto[];
  authorPhotoUrl: string | null;
  happenedOn: string;
}

export interface ProjectUpdatePageDto {
  items: ProjectUpdateDto[];
  total: number;
}

export interface ProjectVolunteerDto {
  volunteerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  roleInProject: string | null;
  joinedAt: string;
  photoUrl: string | null;
}

export interface PublicIndicatorDto {
  name: string;
  unit: string | null;
  value: number;
  national: boolean;
  target: number | null;
}

export interface PublicNucleoDto {
  name: string;
  logoUrl: string | null;
  cnpj: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
}

export interface PublicPartnerDto {
  name: string;
  role: string | null;
}

export interface PublicProgramDto {
  name: string;
  icon: string;
  color: string;
  description: string | null;
  objective: string | null;
  audience: string | null;
  partners: PublicPartnerDto[];
  sinceYear: number | null;
  cities: string[];
  nucleo: PublicNucleoDto;
  totals: PublicProgramTotalsDto;
  results: PublicIndicatorDto[];
  projects: PublicProjectDto[];
  updatedAt: string | null;
}

export interface PublicProgramTotalsDto {
  concluded: number;
  inProgress: number;
  planning: number;
  paused: number;
  volunteers: number;
  hours: number;
}

export interface PublicProjectDto {
  name: string;
  status: ProjectStatus;
  district: string | null;
  city: string | null;
  state: string | null;
  startDate: string;
  endDateForecast: string | null;
  progress: number | null;
  indicators: PublicIndicatorDto[];
  lastUpdateAt: string | null;
  closedOn: string | null;
}

export type ReportFormat = 'Completo' | 'Resumo';

export interface ReportPeriodCountDto {
  projectId: string;
  updates: number;
  photos: number;
  tasks: number;
}

export interface ReportRequest {
  projectIds: string[];
  format: ReportFormat;
  includeVolunteers: boolean;
  includeIndicators: boolean;
  includeUpdates: boolean;
  includePhotos: boolean;
  includeTasks: boolean;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface SaveActivityRequest {
  title: string;
  description: string | null;
  assignedVolunteerId: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  dueDate: string | null;
  blockedReason: string | null;
}

export interface SaveAvailabilityRequest {
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  transport: TransportMode | null;
  slots: AvailabilitySlotDto[] | null;
}

export interface SaveChecklistItemRequest {
  text: string;
}

export interface SaveCommentRequest {
  text: string;
  mentionedVolunteerIds: string[] | null;
}

export interface SaveFileDescriptionRequest {
  description: string | null;
}

export interface SaveHourEntryRequest {
  volunteerId: string | null;
  date: string;
  hours: number;
  description: string | null;
}

export interface SaveIndicatorRequest {
  name: string;
  unit: string | null;
  value: number | null;
  nationalIndicatorId: string | null;
}

export interface SaveNationalIndicatorRequest {
  name: string;
  unit: string | null;
  description: string | null;
}

export interface SaveNucleoRequest {
  name: string;
  city: string | null;
  state: string | null;
}

export interface SaveOrganizationRequest {
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

export interface SaveProgramPartnerRequest {
  id: string | null;
  name: string;
  role: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface SaveProgramPartnersRequest {
  partners: SaveProgramPartnerRequest[];
}

export interface SaveProgramPublicPageRequest {
  enabled: boolean;
}

export interface SaveProgramRequest {
  name: string;
  icon: string | null;
  color: string | null;
}

export interface SaveProgramTemplateRequest {
  activities: SaveTemplateActivityRequest[];
  indicators: SaveTemplateIndicatorRequest[];
}

export interface SaveProjectRequest {
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
  closedOn: string | null;
  useTemplate: boolean;
}

export interface SaveProjectUpdateRequest {
  text: string;
  happenedOn: string | null;
}

export interface SaveStatusPeriodRequest {
  status: VolunteerStatus;
  startsOn: string;
  endsOn: string | null;
}

export interface SaveTemplateActivityRequest {
  id: string | null;
  title: string;
  description: string | null;
  priority: ActivityPriority;
  dueDays: number | null;
}

export interface SaveTemplateIndicatorRequest {
  id: string | null;
  name: string;
  unit: string | null;
  nationalIndicatorId: string | null;
  target: number | null;
}

export interface SaveVolunteerRequest {
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  skills: string | null;
  notes: string | null;
  status: VolunteerStatus;
  birthDay: number | null;
  birthMonth: number | null;
  activeSince: string | null;
  deactivateAccess: boolean;
  releaseTasks: boolean;
}

export interface SearchActivityDto {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: ActivityStatus;
}

export interface SearchProgramDto {
  id: string;
  name: string;
  icon: string;
  color: string;
  isArchived: boolean;
}

export interface SearchProjectDto {
  id: string;
  name: string;
  programName: string;
  programIcon: string;
  programColor: string;
  status: ProjectStatus;
  isArchived: boolean;
}

export interface SearchResultsDto {
  projects: SearchProjectDto[];
  programs: SearchProgramDto[];
  activities: SearchActivityDto[];
  volunteers: SearchVolunteerDto[];
  updates: SearchUpdateDto[];
}

export interface SearchUpdateDto {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  snippet: string;
}

export interface SearchVolunteerDto {
  id: string;
  name: string;
  sector: VolunteerSector;
  photoUrl: string | null;
}

export interface SetupDto {
  organizationDone: boolean;
  programDone: boolean;
  teamDone: boolean;
}

export type Shift = 'Manha' | 'Tarde' | 'Noite';

export interface SignTermRequest {
  fullName: string | null;
  cpf: string | null;
  imageAuthorized: boolean | null;
  accepted: boolean;
}

export interface SignedDocumentDto {
  id: string;
  kind: SignedDocumentKind;
  fileName: string;
  sizeBytes: number;
  signedOn: string;
  uploadedAt: string;
  uploadedByName: string | null;
  signedOnline: boolean;
  signedAt: string | null;
  imageAuthorized: boolean | null;
}

export type SignedDocumentKind = 'VolunteerTerm' | 'BeneficiaryImageAuthorization';

export interface TemplateActivityDto {
  id: string;
  title: string;
  description: string | null;
  priority: ActivityPriority;
  dueDays: number | null;
}

export interface TemplateIndicatorDto {
  id: string;
  name: string;
  unit: string | null;
  nationalIndicatorId: string | null;
  target: number | null;
}

export interface TermClause {
  title: string;
  text: string;
}

export type TransportMode = 'Carro' | 'TransportePublico';

export interface UnreadNotificationsDto {
  linked: boolean;
  count: number;
}

export interface UpdateActivityStatusRequest {
  status: ActivityStatus;
  blockedReason: string | null;
}

export interface UpdateChecklistItemRequest {
  text: string | null;
  done: boolean | null;
}

export interface UpdateProgramRequest {
  name: string;
  status: ProgramStatus;
  icon: string | null;
  color: string | null;
  description: string | null;
  objective: string | null;
  audience: string | null;
}

export interface UpdateProjectStatusRequest {
  status: ProjectStatus;
  closedOn: string | null;
}

export interface UpdateProjectVolunteerRequest {
  roleInProject: string | null;
}

export interface UpdateUserRequest {
  role: UserRole;
  isActive: boolean;
  volunteerId: string | null;
}

export interface UseAccessLinkRequest {
  password: string;
  acceptTerms: boolean;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  volunteerId: string | null;
  volunteerName: string | null;
  volunteerPhotoUrl: string | null;
  termsPending: boolean;
  passwordPending: boolean;
  organizationId: string | null;
  isNational: boolean;
  linkExpiresAt: string | null;
}

export type UserRole = 'Administrador' | 'Coordenador' | 'Usuario';

export interface VolunteerAccessDto {
  userId: string;
  role: UserRole;
  isActive: boolean;
  pending: boolean;
  linkExpiresAt: string | null;
}

export interface VolunteerAvailabilityDto {
  district: string | null;
  city: string | null;
  located: boolean;
  transport: TransportMode | null;
  slots: AvailabilitySlotDto[];
  updatedAt: string | null;
}

export interface VolunteerDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  skills: string | null;
  notes: string | null;
  status: VolunteerStatus;
  projects: VolunteerProjectDto[];
  createdAt: string;
  birthDay: number | null;
  birthMonth: number | null;
  photoUrl: string | null;
  termSignedOn: string | null;
  anonymized: boolean;
  access: VolunteerAccessDto | null;
  availability: VolunteerAvailabilityDto | null;
}

export interface VolunteerHoursDto {
  hours: number;
  weeklyHours: number;
  history: VolunteerStatusPeriodDto[] | null;
}

export interface VolunteerLoadDto {
  volunteerId: string;
  status: VolunteerStatus;
  openActivities: number;
  lateActivities: number;
}

export interface VolunteerProjectDto {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  programName: string;
  roleInProject: string | null;
}

export type VolunteerSector = 'Projetos' | 'Juridico' | 'Pessoas' | 'Comunicacao' | 'Qualidade' | 'Financeiro';

export type VolunteerStatus = 'Ativo' | 'Inativo' | 'ExMembro' | 'Afastado';

export interface VolunteerStatusPeriodDto {
  id: string;
  status: VolunteerStatus;
  startsOn: string;
  endsOn: string | null;
}

export interface VolunteerTermText {
  title: string;
  opening: string;
  commitment: string;
  clauses: TermClause[];
}

export type WeekDay = 'Segunda' | 'Terca' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sabado' | 'Domingo';
