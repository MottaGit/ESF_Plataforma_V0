import { shrinkImage } from '../utils/images';
import { http } from './client';
import type {
  Activity,
  Dashboard,
  Indicator,
  LoginResponse,
  NotificationList,
  Organization,
  Program,
  ProjectDetail,
  ProjectFile,
  ProjectFilters,
  ProjectListItem,
  ProjectUpdate,
  ProjectVolunteer,
  ReportPayload,
  SaveActivityPayload,
  SaveIndicatorPayload,
  SaveOrganizationPayload,
  SaveProgramPayload,
  SaveProjectPayload,
  SaveUserPayload,
  SaveVolunteerPayload,
  SignedDocument,
  UnreadNotifications,
  UpdateProgramPayload,
  User,
  Volunteer,
  VolunteerSector
} from '../types/api';

export const authApi = {
  login: (email: string, password: string) =>
    http.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuthRedirect: true
    }),
  me: () => http.request<User>('/api/auth/me'),
  acceptTerms: () => http.request<User>('/api/auth/accept-terms', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    http.request<void>('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
};

export const dashboardApi = {
  get: () => http.request<Dashboard>('/api/dashboard')
};

export const projectsApi = {
  list: (filters: ProjectFilters = {}) =>
    http.request<ProjectListItem[]>('/api/projects', {
      query: {
        search: filters.search,
        status: filters.status || undefined,
        programId: filters.programId,
        ownerVolunteerId: filters.ownerVolunteerId,
        onlyLate: filters.onlyLate,
        includeArchived: filters.includeArchived,
        sort: filters.sort
      }
    }),
  get: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}`),
  create: (payload: SaveProjectPayload) =>
    http.request<ProjectDetail>('/api/projects', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveProjectPayload) =>
    http.request<ProjectDetail>(`/api/projects/${id}`, { method: 'PUT', body: payload }),
  updateStatus: (id: string, status: string) =>
    http.request<ProjectDetail>(`/api/projects/${id}/status`, { method: 'PATCH', body: { status } }),
  archive: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}/unarchive`, { method: 'POST' }),
  remove: (id: string) => http.request<void>(`/api/projects/${id}`, { method: 'DELETE' })
};

export const programsApi = {
  // Vai como texto: o cliente omite parametros false, e na API o padrao aqui e "so ativos".
  list: (onlyActive = true) => http.request<Program[]>('/api/programs', { query: { onlyActive: String(onlyActive) } }),
  create: (payload: SaveProgramPayload) =>
    http.request<Program>('/api/programs', { method: 'POST', body: payload }),
  /** Renomear e arquivar/reativar. */
  update: (id: string, payload: UpdateProgramPayload) =>
    http.request<Program>(`/api/programs/${id}`, { method: 'PUT', body: payload }),
  /** So para programa sem projetos. */
  remove: (id: string) => http.request<void>(`/api/programs/${id}`, { method: 'DELETE' })
};

export const activitiesApi = {
  listByProject: (projectId: string) => http.request<Activity[]>(`/api/projects/${projectId}/activities`),
  /** mine=true: so as atividades do voluntario vinculado ao usuario logado. */
  upcoming: (take = 8, mine = false) =>
    http.request<Activity[]>('/api/activities/upcoming', { query: { take, mine } }),
  /** Quadro de atividades: projetos em planejamento ou em andamento; concluidas dos ultimos 30 dias. */
  board: () => http.request<Activity[]>('/api/activities/board'),
  create: (projectId: string, payload: SaveActivityPayload) =>
    http.request<Activity>(`/api/projects/${projectId}/activities`, { method: 'POST', body: payload }),
  update: (id: string, payload: SaveActivityPayload) =>
    http.request<Activity>(`/api/activities/${id}`, { method: 'PUT', body: payload }),
  /** blockedReason so vale (e so e guardado) quando o status e Bloqueada. */
  updateStatus: (id: string, status: string, blockedReason: string | null = null) =>
    http.request<Activity>(`/api/activities/${id}/status`, { method: 'PATCH', body: { status, blockedReason } }),
  remove: (id: string) => http.request<void>(`/api/activities/${id}`, { method: 'DELETE' })
};

export const volunteersApi = {
  list: (search?: string, onlyActive = false, sector?: VolunteerSector) =>
    http.request<Volunteer[]>('/api/volunteers', { query: { search, onlyActive, sector } }),
  get: (id: string) => http.request<Volunteer>(`/api/volunteers/${id}`),
  create: (payload: SaveVolunteerPayload) =>
    http.request<Volunteer>('/api/volunteers', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveVolunteerPayload) =>
    http.request<Volunteer>(`/api/volunteers/${id}`, { method: 'PUT', body: payload }),
  remove: (id: string) => http.request<void>(`/api/volunteers/${id}`, { method: 'DELETE' }),
  /** Foto ja recortada (quadrada) pelo navegador. */
  uploadPhoto: (id: string, photo: Blob) => {
    const formData = new FormData();
    formData.append('file', photo, 'foto.jpg');
    return http.request<Volunteer>(`/api/volunteers/${id}/photo`, { method: 'POST', formData });
  },
  removePhoto: (id: string) => http.request<Volunteer>(`/api/volunteers/${id}/photo`, { method: 'DELETE' }),
  listByProject: (projectId: string) => http.request<ProjectVolunteer[]>(`/api/projects/${projectId}/volunteers`),
  addToProject: (projectId: string, volunteerId: string, roleInProject: string | null) =>
    http.request<ProjectVolunteer>(`/api/projects/${projectId}/volunteers`, {
      method: 'POST',
      body: { volunteerId, roleInProject }
    }),
  removeFromProject: (projectId: string, volunteerId: string) =>
    http.request<void>(`/api/projects/${projectId}/volunteers/${volunteerId}`, { method: 'DELETE' })
};

export const indicatorsApi = {
  listByProject: (projectId: string) => http.request<Indicator[]>(`/api/projects/${projectId}/indicators`),
  create: (projectId: string, payload: SaveIndicatorPayload) =>
    http.request<Indicator>(`/api/projects/${projectId}/indicators`, { method: 'POST', body: payload }),
  update: (id: string, payload: SaveIndicatorPayload) =>
    http.request<Indicator>(`/api/indicators/${id}`, { method: 'PUT', body: payload }),
  remove: (id: string) => http.request<void>(`/api/indicators/${id}`, { method: 'DELETE' })
};

export const filesApi = {
  listByProject: (projectId: string) => http.request<ProjectFile[]>(`/api/projects/${projectId}/files`),
  upload: async (projectId: string, file: File, description: string) => {
    const formData = new FormData();
    formData.append('file', await shrinkImage(file));
    if (description) formData.append('description', description);
    return http.request<ProjectFile>(`/api/projects/${projectId}/files`, { method: 'POST', formData });
  },
  updateDescription: (id: string, description: string | null) =>
    http.request<ProjectFile>(`/api/files/${id}`, { method: 'PUT', body: { description } }),
  remove: (id: string) => http.request<void>(`/api/files/${id}`, { method: 'DELETE' })
};

export const projectUpdatesApi = {
  listByProject: (projectId: string) => http.request<ProjectUpdate[]>(`/api/projects/${projectId}/updates`),
  create: async (projectId: string, text: string, files: File[]) => {
    const formData = new FormData();
    formData.append('text', text);
    (await Promise.all(files.map(shrinkImage))).forEach((file) => formData.append('files', file));
    return http.request<ProjectUpdate>(`/api/projects/${projectId}/updates`, { method: 'POST', formData });
  },
  update: (id: string, text: string) =>
    http.request<ProjectUpdate>(`/api/updates/${id}`, { method: 'PUT', body: { text } }),
  remove: (id: string) => http.request<void>(`/api/updates/${id}`, { method: 'DELETE' }),
  addAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', await shrinkImage(file));
    return http.request<ProjectFile>(`/api/updates/${id}/attachments`, { method: 'POST', formData });
  },
  removeAttachment: (id: string, fileId: string) =>
    http.request<void>(`/api/updates/${id}/attachments/${fileId}`, { method: 'DELETE' })
};

export const reportsApi = {
  generate: (payload: ReportPayload) => http.download('/api/reports/projects', payload, 'relatorio-projetos.pdf')
};

export const usersApi = {
  list: (onlyActive = false) => http.request<User[]>('/api/users', { query: { onlyActive } }),
  create: (payload: SaveUserPayload) =>
    http.request<User>('/api/users', {
      method: 'POST',
      body: {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        password: payload.password,
        volunteerId: payload.volunteerId
      }
    }),
  update: (id: string, payload: SaveUserPayload) =>
    http.request<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive,
        // Sem este campo a API entendia "sem voluntario" e desfazia o vinculo a cada edicao.
        volunteerId: payload.volunteerId,
        newPassword: payload.newPassword || null
      }
    }),
  remove: (id: string) => http.request<void>(`/api/users/${id}`, { method: 'DELETE' })
};

/** Dono dos documentos assinados: um voluntario (termo de adesao) ou um projeto (autorizacao de imagem). */
export type DocumentOwner = { type: 'volunteer' | 'project'; id: string };

const documentsBase = (owner: DocumentOwner) =>
  `/api/${owner.type === 'volunteer' ? 'volunteers' : 'projects'}/${owner.id}/documents`;

/** Documentos assinados (so a coordenacao): modelo em PDF, envio do arquivo assinado e download com login. */
export const documentsApi = {
  list: (owner: DocumentOwner) => http.request<SignedDocument[]>(documentsBase(owner)),
  upload: (owner: DocumentOwner, file: File, signedOn: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signedOn', signedOn);
    return http.request<SignedDocument>(documentsBase(owner), { method: 'POST', formData });
  },
  downloadTemplate: (owner: DocumentOwner) => http.download(`${documentsBase(owner)}/template`, undefined, 'modelo.pdf'),
  download: (document: SignedDocument) =>
    http.download(`/api/documents/${document.id}/download`, undefined, document.fileName),
  remove: (id: string) => http.request<void>(`/api/documents/${id}`, { method: 'DELETE' })
};

export const notificationsApi = {
  list: () => http.request<NotificationList>('/api/notifications'),
  unread: () => http.request<UnreadNotifications>('/api/notifications/unread'),
  markRead: (id: string) => http.request<void>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => http.request<void>('/api/notifications/read-all', { method: 'POST' })
};

export const organizationApi = {
  get: () => http.request<Organization>('/api/organization'),
  update: (payload: SaveOrganizationPayload) =>
    http.request<Organization>('/api/organization', { method: 'PUT', body: payload }),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.request<Organization>('/api/organization/logo', { method: 'POST', formData });
  }
};
