import type {
  ActivityStatus,
  ProjectStatus,
  Shift,
  TransportMode,
  UserRole,
  VolunteerSector,
  VolunteerStatus,
  WeekDay
} from '../types/api';

export const PROJECT_STATUSES: ProjectStatus[] = ['Planejamento', 'EmAndamento', 'Pausado', 'Concluido', 'Cancelado'];

/** Projetos com um desses status contam como historico (nao mais "atuais") para um voluntario. */
const PAST_PROJECT_STATUSES = new Set<ProjectStatus>(['Concluido', 'Cancelado']);
export const isPastProjectStatus = (status: ProjectStatus) => PAST_PROJECT_STATUSES.has(status);

export const ACTIVITY_STATUSES: ActivityStatus[] = ['AFazer', 'EmAndamento', 'Bloqueada', 'Concluida'];


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
export const roleLabel = (role: UserRole) => roleLabels[role] ?? role;
export const sectorLabel = (sector: VolunteerSector) => sectorLabels[sector] ?? sector;
export const volunteerStatusLabel = (status: VolunteerStatus) => volunteerStatusLabels[status] ?? status;

/** Grade de disponibilidade: dias a partir da segunda e os tres turnos. */
export const WEEK_DAYS: WeekDay[] = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];
export const SHIFTS: Shift[] = ['Manha', 'Tarde', 'Noite'];
export const TRANSPORT_MODES: TransportMode[] = ['Carro', 'TransportePublico'];

const weekDayShort: Record<WeekDay, string> = {
  Segunda: 'Seg',
  Terca: 'Ter',
  Quarta: 'Qua',
  Quinta: 'Qui',
  Sexta: 'Sex',
  Sabado: 'Sáb',
  Domingo: 'Dom'
};

const weekDayLong: Record<WeekDay, string> = {
  Segunda: 'segunda',
  Terca: 'terça',
  Quarta: 'quarta',
  Quinta: 'quinta',
  Sexta: 'sexta',
  Sabado: 'sábado',
  Domingo: 'domingo'
};

const shiftLabels: Record<Shift, string> = { Manha: 'Manhã', Tarde: 'Tarde', Noite: 'Noite' };

const transportLabels: Record<TransportMode, string> = { Carro: 'Carro', TransportePublico: 'Transporte público' };

export const weekDayShortLabel = (day: WeekDay) => weekDayShort[day] ?? day;
export const weekDayLabel = (day: WeekDay) => weekDayLong[day] ?? day;
export const shiftLabel = (shift: Shift) => shiftLabels[shift] ?? shift;
export const transportLabel = (mode: TransportMode) => transportLabels[mode] ?? mode;

const shiftPhrases: Record<Shift, string> = { Manha: 'de manhã', Tarde: 'à tarde', Noite: 'à noite' };

/** Turno no meio de uma frase: "segunda de manhã", "quinta à tarde". */
export const shiftPhrase = (shift: Shift) => shiftPhrases[shift] ?? shift;

const WEEK_DAY_SHORT_BY_JS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEK_DAY_LONG_BY_JS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Dia da semana de uma data "2026-11-20" (0 = domingo, como no Date). */
function weekDayIndex(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).getDay();
}

/** Dia da visita nas listas: "qui 20/11 · tarde" (com o ano quando nao e o deste ano). */
export function visitDayLabel(date: string | null, shift: Shift | null) {
  if (!date) return 'sem dia';
  const day = `${WEEK_DAY_SHORT_BY_JS[weekDayIndex(date)]} ${shortDate(date)}`;
  return shift ? `${day} · ${shiftLabel(shift).toLowerCase()}` : day;
}

/** Dia da visita por extenso, na janela da tarefa: "quinta, 20/11/2026 à tarde, 14:30". */
export function visitWhenLabel(date: string | null, shift: Shift | null, time: string | null) {
  if (!date) return 'Sem dia marcado';
  const day = `${WEEK_DAY_LONG_BY_JS[weekDayIndex(date)]}, ${formatDate(date)}`;
  return `${day}${shift ? ` ${shiftPhrase(shift)}` : ''}${time ? `, ${time}` : ''}`;
}

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

/** Horas lancadas: 3 -> "3 h", 2.5 -> "2,5 h". */
export function formatHours(value: number) {
  return `${formatNumber(value)} h`;
}

export function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('pt-BR')
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/**
 * Situacao do link de quem ainda nao fez o primeiro acesso: "o link vale até 12/11" ou "o link venceu em 05/11: gere
 * outro" (o link vale 7 dias; vencido, a pessoa nao consegue entrar ate receber um novo).
 */
export function accessLinkStatus(expiresAt: string | null | undefined) {
  if (!expiresAt) return 'sem link valendo: gere um';
  const day = formatDate(expiresAt);
  return new Date(expiresAt).getTime() < Date.now() ? `o link venceu em ${day}: gere outro` : `o link vale até ${day}`;
}

/**
 * "informado em 3 de 5 projetos" quando falta algum projeto informar (a mesma frase do PDF); null quando todos
 * informaram.
 */
export function coverageLabel(informed: number, projects: number) {
  if (informed >= projects) return null;
  return `informado em ${informed} de ${projects} ${projects === 1 ? 'projeto' : 'projetos'}`;
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
export function deadlineLabel(endDate: string | null, status: ProjectStatus, closedOn: string | null = null) {
  // Encerrado: o dia em que terminou (sem ele, nos encerrados antes de o campo existir, a previsao).
  if (closedOn && isPastProjectStatus(status))
    return `${status === 'Cancelado' ? 'Cancelado' : 'Concluído'} em ${formatDate(closedOn)}`;
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

/** Dia curto: "11/11" (com o ano so quando nao e o deste ano). Para cartoes estreitos, como o do quadro. */
export function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return '—';
  return Number(year) === new Date().getFullYear() ? `${day}/${month}` : `${day}/${month}/${year}`;
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

/** Digitos do telefone; com DDD e sem o 55 do Brasil, o 55 entra na frente. */
function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

/** Link para ligar; null quando o telefone nao tem digitos suficientes. */
export function phoneHref(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phoneDigits(phone);
  if (digits.length < 8) return null;
  return digits.startsWith('55') && digits.length >= 12 ? `tel:+${digits}` : `tel:${digits}`;
}

/** Conversa no WhatsApp, so para celular do Brasil (DDD + 9 + 8 digitos). */
export function whatsAppHref(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phoneDigits(phone);
  return /^55\d{2}9\d{8}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

/** Quando o acesso nao esta vinculado a um voluntario, nao ha como saber quais atividades sao da pessoa. */
export const UNLINKED_MESSAGE =
  'Seu acesso ainda não está vinculado a um voluntário, então não dá para saber quais tarefas são suas. Peça a um administrador para fazer o vínculo em Configurações › Acessos.';

/**
 * Quando algo aconteceu, em texto curto: "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" e, a partir de uma semana,
 * a data ("09/10"; com o ano so quando nao e o ano atual).
 */
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
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: sameYear ? undefined : 'numeric' });
}

/** timeAgo no meio de uma frase: "último registro há 3 dias", "último registro em 09/10". */
export function timeAgoPhrase(value: string) {
  const text = timeAgo(value);
  return /^\d/.test(text) ? `em ${text}` : text;
}

/** Dica dos campos de texto livre: a plataforma nao deve guardar dados sensiveis (LGPD). */
export const SENSITIVE_DATA_HINT = 'Não registre dados sensíveis (saúde, religião, origem, opinião política) nem CPF.';
