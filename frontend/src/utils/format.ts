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

export const ACTIVITY_STATUSES: ActivityStatus[] = ['AFazer', 'EmAndamento', 'Bloqueada', 'Concluida'];

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
  AFazer: 'Não iniciada',
  EmAndamento: 'Em andamento',
  Bloqueada: 'Bloqueada',
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
  Usuario: 'Participa dos projetos e atualiza a execução das tarefas.'
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

export const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

/**
 * Nome exibido da pessoa logada: o do voluntario vinculado ao acesso; sem vinculo, o do proprio usuario.
 * (Os dados da conta em Configuracoes continuam mostrando o nome do usuario.)
 */
export function displayName(user: { name: string; volunteerName: string | null } | null | undefined) {
  return user?.volunteerName ?? user?.name ?? '';
}

/** "Ana", "Ana e João", "Ana, João e Maria". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** "12 de março" (aniversario guarda so dia e mes). */
export function birthdayLabel(day: number | null, month: number | null) {
  if (!day || !month) return null;
  return `${day} de ${MONTH_NAMES[month - 1]}`;
}

/** Aniversario hoje, pela data local de quem esta usando. */
export function isBirthdayToday(day: number | null, month: number | null) {
  if (!day || !month) return false;
  const today = new Date();
  return today.getDate() === day && today.getMonth() + 1 === month;
}

/**
 * Dias de hoje ate o aniversario (so dia e mes), quando ele cai na janela [-daysBack, +daysAhead]: negativo se
 * ja passou, 0 hoje, positivo se ainda vem. Fora da janela, null. Olha o ano anterior, o atual e o seguinte,
 * entao atravessa a virada do ano; 29/02 em ano nao bissexto conta como 28/02.
 */
export function birthdayOffset(day: number, month: number, daysBack: number, daysAhead: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const birthday = new Date(year, month - 1, Math.min(day, lastDayOfMonth));
    const offset = Math.round((birthday.getTime() - today.getTime()) / 86400000);
    if (offset >= -daysBack && offset <= daysAhead) return offset;
  }
  return null;
}

/** Dias de hoje ate a data ("2026-03-14"): positivo no futuro, negativo no passado. */
export function daysFromToday(date: string) {
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Prazo do projeto em texto: "Faltam 45 dias (até 30/11/2026)", "Atrasado há 5 dias". */
export function deadlineLabel(endDate: string | null, status: ProjectStatus) {
  if (!endDate) return 'Sem previsão de término';
  if (isPastProjectStatus(status)) return `Previsão de término: ${formatDate(endDate)}`;

  const diff = daysFromToday(endDate);
  if (diff === 0) return `Termina hoje (${formatDate(endDate)})`;
  if (diff === 1) return `Falta 1 dia (até ${formatDate(endDate)})`;
  if (diff > 1) return `Faltam ${diff} dias (até ${formatDate(endDate)})`;
  if (diff === -1) return `Atrasado há 1 dia (previsão era ${formatDate(endDate)})`;
  return `Atrasado há ${Math.abs(diff)} dias (previsão era ${formatDate(endDate)})`;
}

/**
 * Prazo de atividade como data curta: "até 14/07" (com o ano quando nao e o ano corrente) ou "sem prazo".
 * E o que aparece nas listas e no quadro; quando venceu, so a cor do texto muda.
 */
export function dueDateLabel(dueDate: string | null) {
  if (!dueDate) return 'sem prazo';
  const [year, month, day] = dueDate.slice(0, 10).split('-');
  const sameYear = Number(year) === new Date().getFullYear();
  return `até ${day}/${month}${sameYear ? '' : `/${year}`}`;
}

/** Detalhe do prazo para a dica do mouse: "Prazo: 14/07/2026 (atrasada 3 dias)". */
export function dueDateTitle(dueDate: string | null) {
  return dueDate ? `Prazo: ${formatDate(dueDate)} (${dueLabel(dueDate)})` : undefined;
}

/** Texto curto de prazo de atividade: "em 4 dias", "atrasada 2 dias", "hoje". */
export function dueLabel(dueDate: string | null) {
  if (!dueDate) return 'sem prazo';
  const diff = daysFromToday(dueDate);

  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'atrasada 1 dia';
  if (diff < 0) return `atrasada ${Math.abs(diff)} dias`;
  return `em ${diff} dias`;
}

export function emptyToNull(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Quando o acesso nao esta vinculado a um voluntario, nao ha como saber quais atividades sao da pessoa. */
export const UNLINKED_MESSAGE =
  'Seu acesso ainda não está vinculado a um voluntário, então não dá para saber quais tarefas são suas. Peça a um administrador para fazer o vínculo em Configurações › Usuários.';

/** Quando algo aconteceu, em texto curto: "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" ou a data. */
export function timeAgo(value: string) {
  const date = new Date(value);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;

  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (days <= 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Dica dos campos de texto livre: a plataforma nao deve guardar dados sensiveis (LGPD). */
export const SENSITIVE_DATA_HINT = 'Não registre dados sensíveis (saúde, religião, origem, opinião política) nem CPF.';
