/* Tipos espelhando os DTOs da API (Esf.Api/Dtos). */

export type UserRole = 'Administrador' | 'Coordenador' | 'Usuario';

export type ProjectStatus = 'Planejamento' | 'EmAndamento' | 'Pausado' | 'Concluido' | 'Cancelado';

export type ActivityStatus = 'AFazer' | 'EmAndamento' | 'Concluida';

export type ActivityPriority = 'Baixa' | 'Media' | 'Alta';

export type VolunteerSector = 'Projetos' | 'Juridico' | 'Pessoas' | 'Comunicacao' | 'Qualidade' | 'Financeiro';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface ProjectListItem {
  id: string;
  name: string;
  category: string;
  status: ProjectStatus;
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
  roleInProject: string | null;
}

export interface Volunteer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  notes: string | null;
  isActive: boolean;
  projects: VolunteerProject[];
  createdAt: string;
}

export interface ProjectVolunteer {
  volunteerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  sector: VolunteerSector;
  roleInProject: string | null;
  joinedAt: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  text: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
  attachments: ProjectFile[];
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
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: ProjectStatus;
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

export interface ProjectTotals {
  projects: number;
  inProgress: number;
  planning: number;
  completed: number;
  late: number;
  pendingActivities: number;
  volunteers: number;
}

export interface StatusCount {
  status: ProjectStatus;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface IndicatorSummary {
  name: string;
  unit: string | null;
  value: number;
}

export interface Dashboard {
  totals: ProjectTotals;
  byStatus: StatusCount[];
  byCategory: CategoryCount[];
  topIndicators: IndicatorSummary[];
  activeProjects: ProjectListItem[];
  upcomingActivities: Activity[];
}

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
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
  category: string;
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
  progress: number;
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
  notes: string | null;
  isActive: boolean;
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
  password?: string;
  newPassword?: string;
}

export interface SaveOrganizationPayload {
  name: string;
  legalName: string | null;
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
  includeActivities: boolean;
  includeVolunteers: boolean;
  includeIndicators: boolean;
  includeUpdates: boolean;
  includePhotos: boolean;
  note: string | null;
}

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | '';
  category?: string;
  ownerVolunteerId?: string;
  onlyLate?: boolean;
  includeArchived?: boolean;
  sort?: string;
}
