import { useState } from 'react';
import type { Activity, ActivityStatus } from '../../types/api';
import { daysFromToday, dueDateLabel, dueDateTitle, formatDate } from '../../utils/format';
import { ProgramMark } from '../programs/ProgramMark';
import { ActivityCounters } from '../projects/ActivityCounters';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect } from '../ui/Badge';
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

/** Em aberto, por prazo: vencidas, proximos 7 dias, depois e sem prazo. */
export function groupByDue(activities: Activity[]): Group[] {
  const open = activities.filter((activity) => activity.status !== 'Concluida').sort(compareOpen);
  const groups: Group[] = [
    { key: 'late', title: 'Vencidas', late: true, items: open.filter((a) => isOverdue(a)) },
    {
      key: 'week',
      title: 'Próximos 7 dias',
      items: open.filter((a) => a.dueDate && !isOverdue(a) && daysFromToday(a.dueDate) <= 6)
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
  onOpen: (activity: Activity) => void;
  onRequestStatus: (activity: Activity, status: ActivityStatus) => void;
}

/** Tarefas em lista, agrupadas por prazo. A caixinha conclui; clicar no titulo abre a tarefa. */
export function TaskList({ activities, showDone, hasFilters, onOpen, onRequestStatus }: TaskListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups: Group[] = showDone
    ? [
        {
          key: 'done',
          title: `Concluídas nos últimos ${DONE_DAYS} dias`,
          items: activities.filter((a) => a.status === 'Concluida').sort(compareDone)
        }
      ].filter((group) => group.items.length > 0)
    : groupByDue(activities);

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
                <TaskRow key={activity.id} activity={activity} onOpen={onOpen} onRequestStatus={onRequestStatus} />
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
  onOpen: (activity: Activity) => void;
  onRequestStatus: (activity: Activity, status: ActivityStatus) => void;
}

function TaskRow({ activity, onOpen, onRequestStatus }: TaskRowProps) {
  const done = activity.status === 'Concluida';
  const late = isOverdue(activity);

  return (
    <li className={`task-row${done ? ' task-row--done' : ''}`}>
      <input
        type="checkbox"
        className="task-row__check"
        checked={done}
        aria-label={done ? `Reabrir "${activity.title}"` : `Concluir "${activity.title}"`}
        title={done ? 'Reabrir tarefa' : 'Marcar como concluída'}
        onChange={(event) => onRequestStatus(activity, event.target.checked ? 'Concluida' : 'AFazer')}
      />
      <button type="button" className="task-row__main" onClick={() => onOpen(activity)}>
        <span className="task-row__title">
          {activity.title}
          {activity.priority === 'Alta' && !done ? <span className="badge badge--cancel">Alta</span> : null}
        </span>
        <span className="task-row__meta">
          {activity.programIcon && activity.programColor ? (
            <ProgramMark icon={activity.programIcon} color={activity.programColor} size={16} />
          ) : null}
          <span className="task-row__project">{activity.projectName}</span>
          <ActivityCounters activity={activity} />
        </span>
        {activity.status === 'Bloqueada' && activity.blockedReason ? (
          <span className="task-row__blocked">{activity.blockedReason}</span>
        ) : null}
      </button>
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
        {done ? (activity.completedAt ? `concluída ${formatDate(activity.completedAt)}` : 'concluída') : dueDateLabel(activity.dueDate)}
      </span>
    </li>
  );
}
