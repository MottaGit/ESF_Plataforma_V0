import type { ProjectDetail } from '../../types/api';
import { daysFromToday, dueLabel } from '../../utils/format';
import { Progress } from '../ui/Progress';

interface ProjectStatusStripProps {
  project: ProjectDetail;
  onOpenTab: (tab: 'activities' | 'team', filter?: 'atrasadas') => void;
}

/**
 * Faixa de situacao do projeto, logo abaixo do cabecalho e visivel em todas as abas:
 * progresso, atividades atrasadas, proximos prazos e equipe. Cada bloco leva a aba correspondente.
 */
export function ProjectStatusStrip({ project, onOpenTab }: ProjectStatusStripProps) {
  const total = project.activities.length;
  const done = project.activities.filter((activity) => activity.status === 'Concluida').length;
  const pending = project.activities.filter((activity) => activity.status !== 'Concluida');

  const late = pending
    .filter((activity) => activity.isLate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const upcoming = pending
    .filter((activity) => activity.dueDate && !activity.isLate && daysFromToday(activity.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  // Responsavel pelo projeto primeiro, depois o restante da equipe.
  const team = [...project.volunteers].sort((a, b) =>
    a.volunteerId === project.ownerVolunteerId ? -1 : b.volunteerId === project.ownerVolunteerId ? 1 : 0
  );
  const teamNames = team.slice(0, 2).map((member) => member.name.split(' ')[0]);

  return (
    <div className="status-strip">
      <button type="button" className="status-tile" onClick={() => onOpenTab('activities')}>
        <span className="status-tile__label">Progresso</span>
        <Progress value={project.progress} />
        <span className="status-tile__hint num">
          {total === 0 ? 'Nenhuma atividade cadastrada' : `${done} de ${total} atividades concluídas`}
        </span>
      </button>

      <button
        type="button"
        className={`status-tile${late.length > 0 ? ' status-tile--alert' : ''}`}
        onClick={() => onOpenTab('activities', late.length > 0 ? 'atrasadas' : undefined)}
      >
        <span className="status-tile__label">Atrasadas</span>
        <span className="status-tile__value num">{late.length}</span>
        <span className="status-tile__hint">
          {late.length === 0
            ? 'Nenhuma atividade atrasada'
            : `${late[0].title}${late.length > 1 ? ` e mais ${late.length - 1}` : ''}`}
        </span>
      </button>

      <button type="button" className="status-tile" onClick={() => onOpenTab('activities')}>
        <span className="status-tile__label">Próximos 7 dias</span>
        <span className="status-tile__value num">{upcoming.length}</span>
        <span className="status-tile__hint">
          {upcoming.length === 0
            ? 'Nada vencendo nos próximos dias'
            : `${upcoming[0].title} · ${dueLabel(upcoming[0].dueDate)}`}
        </span>
      </button>

      <button type="button" className="status-tile" onClick={() => onOpenTab('team')}>
        <span className="status-tile__label">Equipe</span>
        <span className="status-tile__value num">{team.length}</span>
        <span className="status-tile__hint">
          {team.length === 0
            ? 'Ninguém vinculado ainda'
            : `${teamNames.join(', ')}${team.length > teamNames.length ? ` e mais ${team.length - teamNames.length}` : ''}`}
        </span>
      </button>
    </div>
  );
}
