import type { ReactNode } from 'react';
import type { ActivityPriority, ActivityStatus, ProjectStatus, VolunteerStatus } from '../../types/api';
import {
  PROJECT_STATUSES,
  activityStatusLabel,
  priorityLabel,
  projectStatusLabel,
  volunteerStatusLabel
} from '../../utils/format';
import { IconChevronDown } from './Icons';

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

const volunteerStatusClass: Record<VolunteerStatus, string> = {
  Ativo: 'badge--run',
  Afastado: 'badge--pause',
  Inativo: 'badge--cancel',
  ExMembro: 'badge--cancel'
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`badge ${projectStatusClass[status]}`}>
      <span className="badge__dot" />
      {projectStatusLabel(status)}
    </span>
  );
}

/** Badge de status que tambem e o seletor para alterar o status do projeto. */
export function StatusSelect({ status, onChange }: { status: ProjectStatus; onChange: (status: ProjectStatus) => void }) {
  return (
    <label className={`badge badge--select ${projectStatusClass[status]}`} title="Alterar status do projeto">
      <span className="badge__dot" />
      <select
        value={status}
        aria-label="Status do projeto"
        onChange={(event) => onChange(event.target.value as ProjectStatus)}
      >
        {PROJECT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {projectStatusLabel(value)}
          </option>
        ))}
      </select>
      <IconChevronDown size={13} />
    </label>
  );
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return <span className={`badge ${activityStatusClass[status]}`}>{activityStatusLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: ActivityPriority }) {
  return <span className={`badge ${priorityClass[priority]}`}>{priorityLabel(priority)}</span>;
}

export function VolunteerStatusBadge({ status }: { status: VolunteerStatus }) {
  return <span className={`badge ${volunteerStatusClass[status]}`}>{volunteerStatusLabel(status)}</span>;
}

export function LateBadge({ label = 'Atrasado' }: { label?: string }) {
  return <span className="badge badge--late">{label}</span>;
}

export function NeutralBadge({ children }: { children: ReactNode }) {
  return <span className="badge badge--neutral">{children}</span>;
}
