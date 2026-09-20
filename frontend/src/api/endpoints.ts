import { http } from './client';
import type {
  Activity,
  Dashboard,
  Indicator,
  LoginResponse,
  Organization,
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
  SaveProjectPayload,
  SaveUserPayload,
  SaveVolunteerPayload,
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
        category: filters.category,
        ownerUserId: filters.ownerUserId,
        onlyLate: filters.onlyLate,
        includeArchived: filters.includeArchived,
        sort: filters.sort
      }
    }),
  categories: () => http.request<string[]>('/api/projects/categories'),
  get: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}`),
  create: (payload: SaveProjectPayload) =>
    http.request<ProjectDetail>('/api/projects', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveProjectPayload) =>
    http.request<ProjectDetail>(`/api/projects/${id}`, { method: 'PUT', body: payload }),
  updateStatus: (id: string, status: string) =>
    http.request<ProjectDetail>(`/api/projects/${id}/status`, { method: 'PATCH', body: { status } }),
  updateProgress: (id: string, progress: number) =>
    http.request<ProjectDetail>(`/api/projects/${id}/progress`, { method: 'PATCH', body: { progress } }),
  archive: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) => http.request<ProjectDetail>(`/api/projects/${id}/unarchive`, { method: 'POST' }),
  remove: (id: string) => http.request<void>(`/api/projects/${id}`, { method: 'DELETE' })
};

export const activitiesApi = {
  listByProject: (projectId: string) => http.request<Activity[]>(`/api/projects/${projectId}/activities`),
  upcoming: (take = 8) => http.request<Activity[]>('/api/activities/upcoming', { query: { take } }),
  create: (projectId: string, payload: SaveActivityPayload) =>
    http.request<Activity>(`/api/projects/${projectId}/activities`, { method: 'POST', body: payload }),
  update: (id: string, payload: SaveActivityPayload) =>
    http.request<Activity>(`/api/activities/${id}`, { method: 'PUT', body: payload }),
  updateStatus: (id: string, status: string) =>
    http.request<Activity>(`/api/activities/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => http.request<void>(`/api/activities/${id}`, { method: 'DELETE' })
};

export const volunteersApi = {
  list: (search?: string, onlyActive = false, sector?: VolunteerSector) =>
    http.request<Volunteer[]>('/api/volunteers', { query: { search, onlyActive, sector } }),
  create: (payload: SaveVolunteerPayload) =>
    http.request<Volunteer>('/api/volunteers', { method: 'POST', body: payload }),
  update: (id: string, payload: SaveVolunteerPayload) =>
    http.request<Volunteer>(`/api/volunteers/${id}`, { method: 'PUT', body: payload }),
  remove: (id: string) => http.request<void>(`/api/volunteers/${id}`, { method: 'DELETE' }),
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
  upload: (projectId: string, file: File, description: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    return http.request<ProjectFile>(`/api/projects/${projectId}/files`, { method: 'POST', formData });
  },
  remove: (id: string) => http.request<void>(`/api/files/${id}`, { method: 'DELETE' })
};

export const projectUpdatesApi = {
  listByProject: (projectId: string) => http.request<ProjectUpdate[]>(`/api/projects/${projectId}/updates`),
  create: (projectId: string, text: string, files: File[]) => {
    const formData = new FormData();
    formData.append('text', text);
    files.forEach((file) => formData.append('files', file));
    return http.request<ProjectUpdate>(`/api/projects/${projectId}/updates`, { method: 'POST', formData });
  },
  update: (id: string, text: string) =>
    http.request<ProjectUpdate>(`/api/updates/${id}`, { method: 'PUT', body: { text } }),
  remove: (id: string) => http.request<void>(`/api/updates/${id}`, { method: 'DELETE' }),
  addAttachment: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
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
      body: { name: payload.name, email: payload.email, role: payload.role, password: payload.password }
    }),
  update: (id: string, payload: SaveUserPayload) =>
    http.request<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive,
        newPassword: payload.newPassword || null
      }
    }),
  remove: (id: string) => http.request<void>(`/api/users/${id}`, { method: 'DELETE' })
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
