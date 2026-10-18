/* Tipos espelhando os DTOs da API (Esf.Api/Dtos). */

export type UserRole = 'Administrador' | 'Coordenador' | 'Usuario';

export type ProjectStatus = 'Planejamento' | 'EmAndamento' | 'Pausado' | 'Concluido' | 'Cancelado';

export type ActivityStatus = 'AFazer' | 'EmAndamento' | 'Concluida';

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
}

export interface DashboardTotals {
  lateActivities: number;
  dueSoonActivities: number;
  inProgressActivities: number;
  activeVolunteers: number;
  activeVolunteersWithoutOpenActivities: number;
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
  dueSoon: number;
}

export interface Dashboard {
  totals: DashboardTotals;
  /** Atividades atrasadas, vencendo em 7 dias ou sem responsavel, mais urgentes primeiro. */
  attention: Activity[];
  workload: VolunteerWorkload[];
  mine: MyActivities | null;
  upcomingActivities: Activity[];
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
}

export interface SaveActivityPayload {
  title: string;
  description: string | null;
  assignedVolunteerId: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  dueDate: string | null;
  notes: string | null;
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
  includeArchived?: boolean;
  sort?: string;
}
