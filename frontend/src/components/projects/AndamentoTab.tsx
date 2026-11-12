import { Link } from 'react-router-dom';
import type { Activity, ProjectDetail } from '../../types/api';
import { dueDateTitle } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { dueText, peopleLabel } from '../tasks/taskUtils';
import { UpdatesSection } from './UpdatesSection';

/** Quantas tarefas e pessoas aparecem na lateral antes do "Ver todas". */
const SIDE_TASKS = 5;
const SIDE_PEOPLE = 6;

interface AndamentoTabProps {
  project: ProjectDetail;
  onChanged: () => void;
  onOpenTab: (tab: 'activities' | 'team') => void;
  /** Veio de um "Registrar": o cursor ja vai para o campo de registro. */
  focusComposer?: boolean;
}

/**
 * Tela inicial do projeto: publicar e acompanhar o andamento, numa coluna com largura de leitura. No computador, a
 * lateral mostra o que vem a seguir (proximas tarefas) e quem esta na equipe; no celular ela some, porque a faixa de
 * situacao acima das abas ja resume isso.
 */
export function AndamentoTab({ project, onChanged, onOpenTab, focusComposer }: AndamentoTabProps) {
  return (
    <div className="feed-layout">
      <div className="feed">
        {/* key: ao ir de um projeto para outro, o campo de registro recomeca com o rascunho do projeto novo */}
        <UpdatesSection key={project.id} project={project} onChanged={onChanged} focusComposer={focusComposer} />
      </div>
      <aside className="feed-side" aria-label="Resumo do projeto">
        <NextTasks project={project} onOpenTab={onOpenTab} />
        <TeamSummary project={project} onOpenTab={onOpenTab} />
      </aside>
    </div>
  );
}

/** Atrasadas primeiro, depois pelo prazo; sem prazo no fim. */
function byDue(a: Activity, b: Activity) {
  if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
  if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : 0;
  return a.dueDate.localeCompare(b.dueDate);
}

function NextTasks({ project, onOpenTab }: { project: ProjectDetail; onOpenTab: (tab: 'activities') => void }) {
  const open = project.activities.filter((activity) => activity.status !== 'Concluida').sort(byDue);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Próximas tarefas</h2>
        {open.length > 0 ? <span className="tab__count num">{open.length}</span> : null}
      </div>
      {open.length === 0 ? (
        <p className="feed-side__empty">
          {project.activities.length === 0 ? 'Nenhuma tarefa cadastrada.' : 'Todas as tarefas estão concluídas.'}
        </p>
      ) : (
        <ul className="side-list">
          {open.slice(0, SIDE_TASKS).map((activity) => (
            <li key={activity.id}>
              <Link className="side-list__item" to={`/projetos/${project.id}?aba=tarefas&tarefa=${activity.id}`}>
                <span className="side-list__title">{activity.title}</span>
                <span className="side-list__meta">
                  {activity.kind === 'Visita' ? 'Visita: ' : ''}
                  {peopleLabel(activity, true)}
                  {' · '}
                  <span
                    className={activity.isLate ? 'late-text' : undefined}
                    title={activity.kind === 'Visita' ? undefined : dueDateTitle(activity.dueDate)}
                  >
                    {dueText(activity)}
                  </span>
                  {activity.status === 'Bloqueada' ? <span className="side-list__blocked"> · bloqueada</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {project.activities.length > 0 ? (
        <button type="button" className="feed-side__more" onClick={() => onOpenTab('activities')}>
          Ver todas as tarefas
        </button>
      ) : null}
    </section>
  );
}

function TeamSummary({ project, onOpenTab }: { project: ProjectDetail; onOpenTab: (tab: 'team') => void }) {
  // Responsavel pelo projeto primeiro, depois o restante da equipe.
  const team = [...project.volunteers].sort((a, b) =>
    a.volunteerId === project.ownerVolunteerId ? -1 : b.volunteerId === project.ownerVolunteerId ? 1 : 0
  );

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Equipe</h2>
        {team.length > 0 ? <span className="tab__count num">{team.length}</span> : null}
      </div>
      {team.length === 0 ? (
        <p className="feed-side__empty">Ninguém vinculado ainda.</p>
      ) : (
        <ul className="side-list">
          {team.slice(0, SIDE_PEOPLE).map((member) => (
            <li key={member.volunteerId}>
              <Link className="side-list__item side-list__item--person" to={`/voluntarios/${member.volunteerId}`}>
                <Avatar name={member.name} photoUrl={member.photoUrl} size={28} />
                <span className="side-list__text">
                  <span className="side-list__title">{member.name}</span>
                  <span className="side-list__meta">
                    {member.volunteerId === project.ownerVolunteerId
                      ? 'Responsável'
                      : member.roleInProject ?? 'Na equipe'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="feed-side__more" onClick={() => onOpenTab('team')}>
        {team.length > SIDE_PEOPLE ? `Ver a equipe toda (${team.length})` : 'Ver equipe e horas'}
      </button>
    </section>
  );
}
