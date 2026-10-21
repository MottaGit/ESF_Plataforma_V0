import type { Activity, ActivityPriority, ActivityStatus } from '../../types/api';
import { daysFromToday } from '../../utils/format';

/** Por quantos dias uma concluida continua em Tarefas (mesmo valor de ActivityService.BoardDoneDays). */
export const DONE_DAYS = 30;

const PRIORITY_WEIGHT: Record<ActivityPriority, number> = { Alta: 0, Media: 1, Baixa: 2 };

/** Em aberto: prazo mais proximo primeiro (atrasadas no topo, sem prazo no fim), depois maior prioridade. */
export function compareOpen(a: Activity, b: Activity) {
  const due = (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
  return due || PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.title.localeCompare(b.title);
}

/** Concluidas: as mais recentes primeiro. */
export function compareDone(a: Activity, b: Activity) {
  return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
}

/** Prazo vencido (concluidas e tarefas sem prazo nunca estao atrasadas). */
export function isOverdue(activity: Activity) {
  return activity.status !== 'Concluida' && Boolean(activity.dueDate) && daysFromToday(activity.dueDate!) < 0;
}

/** Copia local com o novo status, para a tela mudar antes da resposta do servidor. */
export function withStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null): Activity {
  return {
    ...activity,
    status,
    blockedReason: status === 'Bloqueada' ? blockedReason : null,
    completedAt: status === 'Concluida' ? new Date().toISOString() : null,
    isLate: status !== 'Concluida' && Boolean(activity.dueDate) && daysFromToday(activity.dueDate!) < 0
  };
}

/** Busca sem diferenciar maiusculas nem acentos. */
export function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
