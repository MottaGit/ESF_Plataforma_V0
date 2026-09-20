import type { ReactNode } from 'react';
import type { ActivityPriority, ActivityStatus, ProjectStatus } from '../../types/api';
import { activityStatusLabel, priorityLabel, projectStatusLabel } from '../../utils/format';

const projectStatusClass: Record<ProjectStatus, string> = {
  Planejamento: 'badge--plan',
  EmAndamento: 'badge--run',
  Pausado: 'badge--pause',
  Concluido: 'badge--done',
  Cancelado: 'badge--cancel'
};

const activityStatusClass: Record<ActivityStatus, string> = {
  AFazer: 'badge--plan',
  EmAndamento: 'badge--run',
  Concluida: 'badge--done'
};

const priorityClass: Record<ActivityPriority, string> = {
  Baixa: 'badge--plan',
  Media: 'badge--pause',
  Alta: 'badge--cancel'
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`badge ${projectStatusClass[status]}`}>
      <span className="badge__dot" />
      {projectStatusLabel(status)}
    </span>
  );
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return <span className={`badge ${activityStatusClass[status]}`}>{activityStatusLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return <span className={`badge ${priorityClass[priority]}`}>{priorityLabel(priority)}</span>;
}

export function LateBadge({ label = 'Atrasado' }: { label?: string }) {
  return <span className="badge badge--late">{label}</span>;
}

export function NeutralBadge({ children }: { children: ReactNode }) {
  return <span className="badge badge--neutral">{children}</span>;
}
