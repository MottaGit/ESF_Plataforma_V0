import { useState } from 'react';
import type { Activity, ActivityStatus } from '../../types/api';
import { activityStatusLabel, daysFromToday, dueDateLabel, dueDateTitle, formatDate } from '../../utils/format';
import { ProgramMark } from '../programs/ProgramMark';
import { ActivityCounters } from '../projects/ActivityCounters';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect, UrgentBadge } from '../ui/Badge';
import { EmptyState } from '../ui/Feedback';
import { DONE_DAYS, compareDone, compareOpen, isOverdue } from './taskUtils';

/** Quantas tarefas cada grupo mostra antes do "Mostrar mais". */
const GROUP_VISIBLE = 10;

interface Group {
  key: string;
  title: string;
  late?: boolean;
  items: Activity[];
}

/**
 * Em aberto, por prazo: atrasadas, proximos 7 dias, depois e sem prazo. As concluidas nesta visita (before) contam
 * com o status de antes: continuam no mesmo grupo, riscadas.
 */
export function groupByDue(activities: Activity[], before?: Map<string, Activity>): Group[] {
  const asBefore = (activity: Activity) => before?.get(activity.id) ?? activity;
  const late = (activity: Activity) => isOverdue(asBefore(activity));
  const open = activities.filter((activity) => asBefore(activity).status !== 'Concluida').sort(compareOpen);
  const groups: Group[] = [
    { key: 'late', title: 'Atrasadas', late: true, items: open.filter(late) },
    {
      key: 'week',
      title: 'Próximos 7 dias',
      items: open.filter((a) => a.dueDate && !late(a) && daysFromToday(a.dueDate) <= 6)
    },
    { key: 'later', title: 'Depois', items: open.filter((a) => a.dueDate && daysFromToday(a.dueDate) > 6) },
    { key: 'none', title: 'Sem prazo', items: open.filter((a) => !a.dueDate) }
  ];
  return groups.filter((group) => group.items.length > 0);
}

interface TaskListProps {
  /** Tarefas ja filtradas pela tela. */
  activities: Activity[];
  /** Recorte "concluidas": mostra so as concluidas recentes, das mais novas para as mais antigas. */
  showDone: boolean;
  hasFilters: boolean;
  /** Concluidas nesta visita, como estavam antes (ver useJustDone): ficam riscadas no lugar, com "Desfazer". */
  before: Map<string, Activity>;
  onOpen: (activity: Activity) => void;
  onRequestStatus: (activity: Activity, status: ActivityStatus) => void;
  /** Desmarcar a caixinha ou "Desfazer": volta ao status de antes (ou a nao iniciada). */
  onReopen: (activity: Activity) => void;
}

/** Tarefas em lista, agrupadas por prazo. A caixinha conclui; clicar no titulo abre a tarefa. */
export function TaskList({ activities, showDone, hasFilters, before, onOpen, onRequestStatus, onReopen }: TaskListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups: Group[] = showDone
    ? [
        {
          key: 'done',
          title: `Concluídas nos últimos ${DONE_DAYS} dias`,
          items: activities.filter((a) => a.status === 'Concluida').sort(compareDone)
        }
      ].filter((group) => group.items.length > 0)
    : groupByDue(activities, before);

  if (groups.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          title={hasFilters ? 'Nenhuma tarefa com esses filtros' : 'Nenhuma tarefa em aberto'}
          description={
            hasFilters
              ? 'Ajuste os filtros para ver as demais tarefas.'
              : 'As tarefas dos projetos em planejamento ou em andamento aparecem aqui.'
          }
        />
      </section>
    );
  }

  return (
    <section className="panel task-list" aria-label="Tarefas">
      {groups.map((group) => {
        const open = expanded.has(group.key);
        const visible = open ? group.items : group.items.slice(0, GROUP_VISIBLE);
        return (
          <div key={group.key} className="task-list__group">
            <h3 className={`task-list__title${group.late ? ' task-list__title--late' : ''}`}>
              {group.title}
              <span className="num">{group.items.length}</span>
            </h3>
            <ul className="task-list__items">
              {visible.map((activity) => (
                <TaskRow
                  key={activity.id}
                  activity={activity}
                  justDone={before.has(activity.id) && activity.status === 'Concluida'}
                  onOpen={onOpen}
                  onRequestStatus={onRequestStatus}
                  onReopen={onReopen}
                />
              ))}
            </ul>
            {group.items.length > GROUP_VISIBLE ? (
              <button
                type="button"
                className="link-button task-list__more"
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(group.key)) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  })
                }
              >
                {open ? 'Mostrar menos' : `Mostrar mais ${group.items.length - GROUP_VISIBLE}`}
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

interface TaskRowProps {
  activity: Activity;
  /** Concluida nesta visita: mostra o "Desfazer". */
  justDone: boolean;
  onOpen: (activity: Activity) => void;
  onRequestStatus: (activity: Activity, status: ActivityStatus) => void;
  onReopen: (activity: Activity) => void;
}

function TaskRow({ activity, justDone, onOpen, onRequestStatus, onReopen }: TaskRowProps) {
  const done = activity.status === 'Concluida';
  const late = isOverdue(activity);

  return (
    <li className={`task-row${done ? ' task-row--done' : ''}`}>
      <label className="check-hit" title={done ? 'Reabrir tarefa' : 'Marcar como concluída'}>
        <input
          type="checkbox"
          className="task-row__check"
          checked={done}
          aria-label={done ? `Reabrir "${activity.title}"` : `Concluir "${activity.title}"`}
          onChange={(event) => (event.target.checked ? onRequestStatus(activity, 'Concluida') : onReopen(activity))}
        />
      </label>
      <button type="button" className="task-row__main" onClick={() => onOpen(activity)}>
        <span className="task-row__title">
          {activity.title}
          {!done ? <UrgentBadge priority={activity.priority} /> : null}
        </span>
        <span className="task-row__meta">
          {/* Icone e nome juntos: quebrando a linha, os dois descem juntos (o nome corta com reticencias). */}
          <span className="task-row__project-wrap">
            {activity.programIcon && activity.programColor ? (
              <ProgramMark icon={activity.programIcon} color={activity.programColor} size={16} />
            ) : null}
            <span className="task-row__project">{activity.projectName}</span>
          </span>
          {/* No celular as colunas de responsavel e status somem: o essencial vem aqui. */}
          <span className={`task-row__mobile${activity.assignedVolunteerName ? '' : ' task-row__mobile--none'}`}>
            {activity.assignedVolunteerName ? activity.assignedVolunteerName.split(' ')[0] : 'Sem responsável'}
          </span>
          {activity.status === 'EmAndamento' || activity.status === 'Bloqueada' ? (
            <span className={`task-row__mobile task-row__mobile--${activity.status === 'Bloqueada' ? 'blocked' : 'running'}`}>
              {activityStatusLabel(activity.status)}
            </span>
          ) : null}
          <ActivityCounters activity={activity} />
        </span>
        {activity.status === 'Bloqueada' && activity.blockedReason ? (
          <span className="task-row__blocked">{activity.blockedReason}</span>
        ) : null}
      </button>
      {justDone ? (
        <button type="button" className="task-row__undo" onClick={() => onReopen(activity)}>
          Desfazer
        </button>
      ) : null}
      <span className="task-row__status">
        <ActivityStatusSelect
          status={activity.status}
          label={`Status de ${activity.title}`}
          onChange={(status) => onRequestStatus(activity, status)}
        />
      </span>
      <span className={`task-row__who${activity.assignedVolunteerName ? '' : ' task-row__who--none'}`}>
        {activity.assignedVolunteerName ? (
          <>
            <Avatar name={activity.assignedVolunteerName} photoUrl={activity.assignedVolunteerPhotoUrl} size={22} />
            <span>{activity.assignedVolunteerName}</span>
          </>
        ) : (
          'Sem responsável'
        )}
      </span>
      <span
        className={`task-row__due${late ? ' task-row__due--late' : ''}`}
        title={done ? undefined : dueDateTitle(activity.dueDate)}
      >
        {done ? (activity.completedAt ? `concluída em ${formatDate(activity.completedAt)}` : 'concluída') : dueDateLabel(activity.dueDate)}
      </span>
    </li>
  );
}
