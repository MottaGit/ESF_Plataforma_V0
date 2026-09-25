import type {
  ActivityPriority,
  ActivityStatus,
  ProjectStatus,
  UserRole,
  VolunteerSector,
  VolunteerStatus
} from '../types/api';

export const PROJECT_STATUSES: ProjectStatus[] = ['Planejamento', 'EmAndamento', 'Pausado', 'Concluido', 'Cancelado'];

/** Projetos com um desses status contam como historico (nao mais "atuais") para um voluntario. */
const PAST_PROJECT_STATUSES = new Set<ProjectStatus>(['Concluido', 'Cancelado']);
export const isPastProjectStatus = (status: ProjectStatus) => PAST_PROJECT_STATUSES.has(status);

export const ACTIVITY_STATUSES: ActivityStatus[] = ['AFazer', 'EmAndamento', 'Concluida'];

export const ACTIVITY_PRIORITIES: ActivityPriority[] = ['Baixa', 'Media', 'Alta'];

export const USER_ROLES: UserRole[] = ['Administrador', 'Coordenador', 'Usuario'];

export const VOLUNTEER_SECTORS: VolunteerSector[] = [
  'Projetos',
  'Juridico',
  'Pessoas',
  'Comunicacao',
  'Qualidade',
  'Financeiro'
];

export const VOLUNTEER_STATUSES: VolunteerStatus[] = ['Ativo', 'Inativo', 'ExMembro', 'Afastado'];

const projectStatusLabels: Record<ProjectStatus, string> = {
  Planejamento: 'Planejamento',
  EmAndamento: 'Em andamento',
  Pausado: 'Pausado',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado'
};

const activityStatusLabels: Record<ActivityStatus, string> = {
  AFazer: 'A fazer',
  EmAndamento: 'Em andamento',
  Concluida: 'Concluída'
};

const priorityLabels: Record<ActivityPriority, string> = {
  Baixa: 'Baixa',
  Media: 'Média',
  Alta: 'Alta'
};

const roleLabels: Record<UserRole, string> = {
  Administrador: 'Administrador',
  Coordenador: 'Coordenador',
  Usuario: 'Usuário'
};

const sectorLabels: Record<VolunteerSector, string> = {
  Projetos: 'Projetos',
  Juridico: 'Jurídico',
  Pessoas: 'Pessoas',
  Comunicacao: 'Comunicação',
  Qualidade: 'Qualidade',
  Financeiro: 'Financeiro'
};

const volunteerStatusLabels: Record<VolunteerStatus, string> = {
  Ativo: 'Ativo',
  Inativo: 'Inativo',
  ExMembro: 'Ex-membro',
  Afastado: 'Afastado'
};

export const projectStatusLabel = (status: ProjectStatus) => projectStatusLabels[status] ?? status;
export const activityStatusLabel = (status: ActivityStatus) => activityStatusLabels[status] ?? status;
export const priorityLabel = (priority: ActivityPriority) => priorityLabels[priority] ?? priority;
export const roleLabel = (role: UserRole) => roleLabels[role] ?? role;
export const sectorLabel = (sector: VolunteerSector) => sectorLabels[sector] ?? sector;
export const volunteerStatusLabel = (status: VolunteerStatus) => volunteerStatusLabels[status] ?? status;

export const roleDescription: Record<UserRole, string> = {
  Administrador: 'Acesso completo, incluindo usuários e dados da organização.',
  Coordenador: 'Cria e gerencia projetos, voluntários e indicadores.',
  Usuario: 'Participa dos projetos e atualiza a execução das atividades.'
};

/** "2026-03-14" -> "14/03/2026" (sem conversao de fuso). */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Data de hoje no formato aceito por <input type="date">. */
export function todayInputValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('pt-BR')
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function fileExtension(fileName: string) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'ARQ';
}

/** Texto curto de prazo: "em 4 dias", "atrasado 2 dias", "hoje". */
export function dueLabel(dueDate: string | null) {
  if (!dueDate) return 'sem prazo';
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'atrasado 1 dia';
  if (diff < 0) return `atrasado ${Math.abs(diff)} dias`;
  return `em ${diff} dias`;
}

export function emptyToNull(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
