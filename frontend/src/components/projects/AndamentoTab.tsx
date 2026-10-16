import type { Activity, ProjectDetail } from '../../types/api';
import { daysFromToday, dueLabel } from '../../utils/format';
import { Progress } from '../ui/Progress';
import { UpdatesSection } from './UpdatesSection';


type OpenTab = (tab: 'activities' | 'team', filter?: 'atrasadas') => void;

interface AndamentoTabProps {
  project: ProjectDetail;
  onChanged: () => void;
  onOpenTab: OpenTab;
}

const MAX_ITEMS = 5;

/** Tela inicial do projeto: publicar e acompanhar o andamento, com o essencial ao lado. */
export function AndamentoTab({ project, onChanged, onOpenTab }: AndamentoTabProps) {
  return (
    <div className="grid-sidebar">
      <UpdatesSection project={project} onChanged={onChanged} />
      <ProjectSummary project={project} onOpenTab={onOpenTab} />
    </div>
  );
}

function ProjectSummary({ project, onOpenTab }: { project: ProjectDetail; onOpenTab: OpenTab }) {
  const done = project.activities.filter((activity) => activity.status === 'Concluida').length;
  const pending = project.activities.filter((activity) => activity.status !== 'Concluida');

  const late = pending.filter((activity) => activity.isLate);
  const upcoming = pending
    .filter((activity) => activity.dueDate && !activity.isLate && daysFromToday(activity.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  // Responsavel pelo projeto primeiro, depois o restante da equipe.
  const team = [...project.volunteers].sort((a, b) =>
    a.volunteerId === project.ownerVolunteerId ? -1 : b.volunteerId === project.ownerVolunteerId ? 1 : 0
  );
  const visibleTeam = team.slice(0, 3).map((member) => member.name);

  return (
    <aside className="panel summary">
      <section className="summary__block">
        <div className="summary__head">
          <h2 className="summary__title">Progresso</h2>
        </div>
        <Progress value={project.progress} />
        <div className="summary__hint num">
          {project.activities.length === 0
            ? 'Nenhuma atividade cadastrada ainda.'
            : `${done} de ${project.activities.length} atividades concluídas`}
        </div>
      </section>

      <section className="summary__block">
        <div className="summary__head">
          <h2 className="summary__title">Atrasadas</h2>
          {late.length > 0 ? <span className="summary__count summary__count--danger num">{late.length}</span> : null}
        </div>
        <ActivityList activities={late} empty="Nenhuma atividade atrasada." />
        {late.length > 0 ? (
          <button type="button" className="summary__link" onClick={() => onOpenTab('activities', 'atrasadas')}>
            Ver atrasadas →
          </button>
        ) : null}
      </section>

      <section className="summary__block">
        <div className="summary__head">
          <h2 className="summary__title">Próximos 7 dias</h2>
          {upcoming.length > 0 ? <span className="summary__count num">{upcoming.length}</span> : null}
        </div>
        <ActivityList activities={upcoming} empty="Nada vencendo nos próximos dias." />
        <button type="button" className="summary__link" onClick={() => onOpenTab('activities')}>
          Ver atividades →
        </button>
      </section>

      <section className="summary__block">
        <div className="summary__head">
          <h2 className="summary__title">Equipe</h2>
          {team.length > 0 ? <span className="summary__count num">{team.length}</span> : null}
        </div>
        {team.length === 0 ? (
          <p className="summary__empty">Ninguém vinculado ainda.</p>
        ) : (
          <p className="summary__text">
            {visibleTeam.join(', ')}
            {team.length > visibleTeam.length ? `, +${team.length - visibleTeam.length}` : ''}
          </p>
        )}
        <button type="button" className="summary__link" onClick={() => onOpenTab('team')}>
          Ver equipe →
        </button>
      </section>
    </aside>
  );
}

function ActivityList({ activities, empty }: { activities: Activity[]; empty: string }) {
  if (activities.length === 0) return <p className="summary__empty">{empty}</p>;

  return (
    <ul className="summary__list">
      {activities.slice(0, MAX_ITEMS).map((activity) => (
        <li key={activity.id}>
          <span className="summary__item-title">{activity.title}</span>
          <span className={`summary__item-meta${activity.isLate ? ' summary__item-meta--late' : ''}`}>
            {activity.assignedVolunteerName ?? 'sem responsável'} · {dueLabel(activity.dueDate)}
          </span>
        </li>
      ))}
      {activities.length > MAX_ITEMS ? (
        <li className="summary__more">e mais {activities.length - MAX_ITEMS}</li>
      ) : null}
    </ul>
  );
}
