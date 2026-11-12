import { useCallback, useState } from 'react';
import type { Activity, ActivityPriority, ActivityStatus } from '../../types/api';
import { daysFromToday, dueDateLabel, visitDayLabel } from '../../utils/format';

/** A pessoa esta na tarefa: responsavel ou, na visita, acompanhante. */
export function involves(activity: Activity, volunteerId: string | null | undefined) {
  return Boolean(volunteerId) && (activity.assignedVolunteerId === volunteerId || activity.companionVolunteerId === volunteerId);
}

/** Responsavel e acompanhante (na visita), com nome e foto. */
export function peopleOf(activity: Activity) {
  const people: Array<{ id: string; name: string; photoUrl: string | null }> = [];
  if (activity.assignedVolunteerId && activity.assignedVolunteerName)
    people.push({ id: activity.assignedVolunteerId, name: activity.assignedVolunteerName, photoUrl: activity.assignedVolunteerPhotoUrl });
  if (activity.companionVolunteerId && activity.companionVolunteerName)
    people.push({ id: activity.companionVolunteerId, name: activity.companionVolunteerName, photoUrl: activity.companionVolunteerPhotoUrl });
  return people;
}

/** "Ana Aumond"; na visita, "Ana e Bruno" (so os primeiros nomes); "Sem responsável" quando nao ha ninguem. */
export function peopleLabel(activity: Activity, firstNamesOnly = false) {
  const names = peopleOf(activity).map((person) => person.name);
  if (names.length === 0) return 'Sem responsável';
  return (firstNamesOnly || names.length > 1 ? names.map((name) => name.split(' ')[0]) : names).join(' e ');
}

/** Data da tarefa nas listas: a visita mostra o dia e o turno ("qui 20/11 · tarde"); a tarefa, o prazo. */
export function dueText(activity: Activity) {
  return activity.kind === 'Visita' ? visitDayLabel(activity.dueDate, activity.visitShift) : dueDateLabel(activity.dueDate);
}

/**
 * Tarefas concluidas nesta visita a tela, guardadas como estavam antes (status e motivo do bloqueio): ficam riscadas
 * no mesmo lugar, com "Desfazer", ate a tela ser aberta de novo. Desfazer volta exatamente para o status de antes.
 * E o mesmo comportamento em Tarefas, no Inicio e na aba Tarefas do projeto.
 */
export function useJustDone() {
  const [before, setBefore] = useState<Map<string, Activity>>(() => new Map());
  const remember = useCallback((activity: Activity) => setBefore((current) => new Map(current).set(activity.id, activity)), []);
  const forget = useCallback(
    (id: string) =>
      setBefore((current) => {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      }),
    []
  );
  return { before, remember, forget };
}

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
