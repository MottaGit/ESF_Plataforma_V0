import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { activitiesApi, dashboardApi, notificationsApi, volunteersApi } from '../api/endpoints';
import { linkFor } from '../components/layout/NotificationBell';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ActivityCounters } from '../components/projects/ActivityCounters';
import { ActivityFormModal } from '../components/projects/ActivityFormModal';
import { groupByDue } from '../components/tasks/TaskList';
import { isOverdue } from '../components/tasks/taskUtils';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge } from '../components/ui/Badge';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Activity, AppNotification, Dashboard, HomeProject, Volunteer, VolunteerWorkload } from '../types/api';
import {
  UNLINKED_MESSAGE,
  birthdayLabel,
  birthdayOffset,
  displayName,
  dueDateLabel,
  dueDateTitle,
  timeAgo,
  timeAgoPhrase
} from '../utils/format';

/** Quantas das minhas tarefas aparecem no Inicio (o resto fica em Tarefas). */
const MY_TASKS_VISIBLE = 8;

/** Janela de aniversarios: os que passaram ha poucos dias e os que vem pela frente. */
const BIRTHDAYS_DAYS_BACK = 10;
const BIRTHDAYS_DAYS_AHEAD = 30;

/** "1 tarefa" / "3 tarefas" e afins. */
function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Inicio: o que a pessoa logada tem para fazer (as tarefas e os projetos dela, os avisos e os aniversarios).
 * A coordenacao ve tambem o resumo da organizacao e a carga da equipe.
 */
export function HomePage() {
  const { user, canManage } = useAuth();
  const { notify } = useToast();

  const [data, setData] = useState<Dashboard | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Activity | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.get());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o início.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    volunteersApi
      .list()
      .then(setVolunteers)
      .catch(() => setVolunteers([]));
  }, [load]);

  if (loading) return <Loading label="Carregando…" />;

  if (error) {
    return (
      <Alert kind="error">
        {error}{' '}
        <button className="btn btn--sm" style={{ marginLeft: 10 }} onClick={() => void load()}>
          Tentar de novo
        </button>
      </Alert>
    );
  }

  if (!data) return null;

  const firstName = displayName(user).split(' ')[0];
  const activeVolunteers = (volunteers ?? []).filter((volunteer) => volunteer.status === 'Ativo');

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Olá, {firstName}</h1>
          <p className="page-head__desc">
            <SummaryLine data={data} />
          </p>
        </div>
      </div>

      {canManage ? <OrgStrip data={data} /> : null}

      <div className="grid-sidebar home">
        <div className="home__col">
          <MyTasksPanel tasks={data.myTasks} total={data.mine?.open ?? 0} onOpen={setOpened} onChanged={() => void load(true)} />
          {canManage ? <WorkloadPanel workload={data.workload} /> : null}
        </div>

        <div className="home__col">
          <MyProjectsPanel projects={data.myProjects} />
          <RecentNotices />
          <BirthdaysPanel volunteers={volunteers} />
        </div>
      </div>

      {opened ? (
        <ActivityFormModal
          projectId={opened.projectId}
          activity={opened}
          volunteers={activeVolunteers}
          onClose={() => setOpened(null)}
          onSaved={() => {
            setOpened(null);
            notify('Tarefa atualizada.');
            void load(true);
          }}
          onExtrasChanged={() => void load(true)}
        />
      ) : null}
    </>
  );
}

/** Resumo de uma linha no cabecalho: as tarefas da propria pessoa. */
function SummaryLine({ data }: { data: Dashboard }) {
  const { mine } = data;
  if (!mine) return <>Bem-vindo à plataforma.</>;
  if (mine.open === 0) return <>Você não tem tarefas em aberto.</>;
  return (
    <>
      Você tem {plural(mine.open, 'tarefa em aberto', 'tarefas em aberto')}
      {mine.late > 0 ? (
        <>
          {' · '}
          <span className="summary-line__late">{plural(mine.late, 'atrasada', 'atrasadas')}</span>
        </>
      ) : null}
      {mine.blocked > 0 ? ` · ${plural(mine.blocked, 'bloqueada', 'bloqueadas')}` : null}
    </>
  );
}

/** Coordenacao: o que pede atencao na organizacao. Cada numero abre a lista correspondente. */
function OrgStrip({ data }: { data: Dashboard }) {
  const { org } = data;
  const tiles = [
    { to: '/tarefas?de=todas&recorte=atrasadas', value: org.lateTasks, label: 'Tarefas atrasadas', alert: org.lateTasks > 0 },
    { to: '/tarefas?de=todas&recorte=bloqueadas', value: org.blockedTasks, label: 'Bloqueadas', alert: false },
    { to: '/tarefas?de=todas&recorte=sem-responsavel', value: org.unassignedTasks, label: 'Sem responsável', alert: false },
    { to: '/projetos?parados=1', value: org.staleProjects, label: 'Projetos parados', hint: 'sem registro há 30 dias', alert: false }
  ];
  return (
    <section className="section" aria-label="Na organização">
      <h2 className="home__label">Na organização</h2>
      <div className="stat-strip">
        {tiles.map((tile) => (
          <Link key={tile.label} className="stat stat--link" to={tile.to}>
            <div className={`stat__value num${tile.alert ? ' stat__value--alert' : ''}`}>{tile.value}</div>
            <div className="stat__label">{tile.label}</div>
            <div className="stat__hint">{tile.hint ?? 'ver a lista'}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface MyTasksPanelProps {
  tasks: Activity[];
  total: number;
  onOpen: (activity: Activity) => void;
  onChanged: () => void;
}

/** Minhas tarefas, agrupadas por prazo. A caixinha conclui na hora; clicar abre a tarefa. */
function MyTasksPanel({ tasks, total, onOpen, onChanged }: MyTasksPanelProps) {
  const { user } = useAuth();
  const { notify, notifyError } = useToast();
  const [doneNow, setDoneNow] = useState<Set<string>>(new Set());
  const linked = Boolean(user?.volunteerId);

  async function complete(activity: Activity, done: boolean) {
    setDoneNow((current) => {
      const next = new Set(current);
      if (done) next.add(activity.id);
      else next.delete(activity.id);
      return next;
    });
    try {
      await activitiesApi.updateStatus(activity.id, done ? 'Concluida' : activity.status);
      if (done) notify(`"${activity.title}" concluída.`);
      onChanged();
    } catch (err) {
      setDoneNow((current) => {
        const next = new Set(current);
        next.delete(activity.id);
        return next;
      });
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível concluir a tarefa.');
    }
  }

  // Grupos por prazo, cortados nas primeiras MY_TASKS_VISIBLE tarefas.
  let budget = MY_TASKS_VISIBLE;
  const groups = groupByDue(tasks)
    .map((group) => {
      const items = group.items.slice(0, Math.max(budget, 0));
      budget -= items.length;
      return { ...group, total: group.items.length, items };
    })
    .filter((group) => group.items.length > 0);
  const hidden = total - groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Minhas tarefas</h2>
        {total > 0 ? <span className="tab__count num">{total}</span> : null}
        {linked ? (
          <div className="panel__actions">
            <Link className="btn btn--sm" to="/tarefas?de=minhas">
              Ver em Tarefas
            </Link>
          </div>
        ) : null}
      </div>
      {!linked ? (
        <div className="panel__body">
          <Alert kind="info">{UNLINKED_MESSAGE}</Alert>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="Nada pendente" description="Você não tem tarefas em aberto." />
      ) : (
        <div className="task-list">
          {groups.map((group) => (
            <div key={group.key} className="task-list__group">
              <h3 className={`task-list__title${group.late ? ' task-list__title--late' : ''}`}>
                {group.key === 'late' ? 'Atrasadas' : group.title}
                <span className="num">{group.total}</span>
              </h3>
              <ul className="task-list__items">
                {group.items.map((activity) => {
                  const checked = doneNow.has(activity.id);
                  return (
                    <li key={activity.id} className={`task-row${checked ? ' task-row--done' : ''}`}>
                      <input
                        type="checkbox"
                        className="task-row__check"
                        checked={checked}
                        aria-label={`Concluir "${activity.title}"`}
                        title="Marcar como concluída"
                        onChange={(event) => void complete(activity, event.target.checked)}
                      />
                      <button type="button" className="task-row__main" onClick={() => onOpen(activity)}>
                        <span className="task-row__title">{activity.title}</span>
                        <span className="task-row__meta">
                          {activity.programIcon && activity.programColor ? (
                            <ProgramMark icon={activity.programIcon} color={activity.programColor} size={16} />
                          ) : null}
                          <span className="task-row__project">{activity.projectName}</span>
                          <ActivityCounters activity={activity} />
                        </span>
                      </button>
                      {activity.status === 'Bloqueada' ? (
                        <span className="badge badge--blocked">bloqueada</span>
                      ) : (
                        <span
                          className={`task-row__due${isOverdue(activity) ? ' task-row__due--late' : ''}`}
                          title={dueDateTitle(activity.dueDate)}
                        >
                          {dueDateLabel(activity.dueDate)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {hidden > 0 ? (
            <Link className="task-list__more link-button" to="/tarefas?de=minhas">
              e mais {plural(hidden, 'tarefa', 'tarefas')} em Tarefas
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** "último registro há 3 dias" / "último registro em 09/10" / "nenhum registro ainda". */
function lastUpdateLabel(project: HomeProject) {
  return project.lastUpdateAt ? `último registro ${timeAgoPhrase(project.lastUpdateAt)}` : 'nenhum registro ainda';
}

/** Projetos da pessoa (responsavel ou na equipe), com atalho para registrar o andamento. */
function MyProjectsPanel({ projects }: { projects: HomeProject[] }) {
  const { user } = useAuth();
  if (!user?.volunteerId) return null;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Meus projetos</h2>
        {projects.length > 0 ? <span className="tab__count num">{projects.length}</span> : null}
      </div>
      {projects.length === 0 ? (
        <div className="panel__body">
          <p className="field__hint">Você ainda não está na equipe de nenhum projeto em andamento.</p>
        </div>
      ) : (
        <ul className="home-projects">
          {projects.map((project) => (
            <li key={project.id} className="home-projects__item">
              <ProgramMark icon={project.programIcon} color={project.programColor} size={28} />
              <div className="home-projects__main">
                <Link className="row-link" to={`/projetos/${project.id}`}>
                  {project.name}
                </Link>
                <Progress value={project.progress} />
                <span className="field__hint">{lastUpdateLabel(project)}</span>
              </div>
              <Link className="btn btn--sm" to={`/projetos/${project.id}?registrar=1`}>
                Registrar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Os ultimos avisos do sininho; clicar marca como lido e leva ao lugar do aviso. */
function RecentNotices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    if (!user?.volunteerId) return;
    notificationsApi
      .list()
      .then((result) => setItems(result.items.slice(0, 3)))
      .catch(() => setItems([]));
  }, [user?.volunteerId]);

  if (!user?.volunteerId) return null;

  async function open(notification: AppNotification) {
    if (!notification.read) await notificationsApi.markRead(notification.id).catch(() => undefined);
    const to = linkFor(notification);
    if (to) navigate(to);
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Avisos recentes</h2>
      </div>
      {items === null ? (
        <Loading label="Carregando avisos…" />
      ) : items.length === 0 ? (
        <div className="panel__body">
          <p className="field__hint">Nenhum aviso por enquanto.</p>
        </div>
      ) : (
        <ul className="home-notices">
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={`home-notices__item${notification.read ? '' : ' home-notices__item--unread'}`}
                onClick={() => void open(notification)}
              >
                <span className="home-notices__dot" aria-hidden="true" />
                <span>
                  {notification.message}
                  <span className="field__hint home-notices__when">{timeAgo(notification.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Coordenacao: quem esta com mais tarefas em aberto. */
function WorkloadPanel({ workload }: { workload: VolunteerWorkload[] }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Quem está mais carregado</h2>
        <div className="panel__actions">
          <Link className="btn btn--sm" to="/tarefas?de=todas">
            Ver em Tarefas
          </Link>
        </div>
      </div>
      <div className="panel__body">
        {workload.length === 0 ? (
          <p className="field__hint">Ninguém está com tarefas em aberto.</p>
        ) : (
          <ul className="team-load">
            {workload.map((item) => (
              <li key={item.volunteerId} className="team-load__item">
                <Avatar name={item.name} photoUrl={item.photoUrl} size={28} />
                <Link className="row-link team-load__name" to={`/tarefas?de=todas&responsavel=${item.volunteerId}`}>
                  {item.name}
                </Link>
                <span className="team-load__count num">
                  {item.openActivities} em aberto
                  {item.lateActivities > 0 ? (
                    <span className="team-load__late">
                      {' · '}
                      {plural(item.lateActivities, 'atrasada', 'atrasadas')}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** "há 3 dias", "ontem", "amanhã", "3 de novembro · em 15 dias". */
function birthdayWhen(day: number, month: number, offset: number) {
  if (offset === -1) return 'ontem';
  if (offset < 0) return `há ${-offset} dias`;
  return `${birthdayLabel(day, month)} · ${offset === 1 ? 'amanhã' : `em ${offset} dias`}`;
}

/**
 * Aniversariantes dos ultimos 10 dias e dos proximos 30 (pela data local de quem esta usando), so de quem
 * ainda faz parte da organizacao (ativos e afastados). Quem ja fez fica esmaecido; o do dia, destacado.
 */
function BirthdaysPanel({ volunteers }: { volunteers: Volunteer[] | null }) {
  const people = (volunteers ?? [])
    .filter((volunteer) => volunteer.status === 'Ativo' || volunteer.status === 'Afastado')
    .flatMap((volunteer) => {
      if (!volunteer.birthDay || !volunteer.birthMonth) return [];
      const offset = birthdayOffset(volunteer.birthDay, volunteer.birthMonth, BIRTHDAYS_DAYS_BACK, BIRTHDAYS_DAYS_AHEAD);
      return offset === null ? [] : [{ volunteer, day: volunteer.birthDay, month: volunteer.birthMonth, offset }];
    })
    .sort((a, b) => a.offset - b.offset || a.volunteer.name.localeCompare(b.volunteer.name));

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Aniversariantes</h2>
      </div>
      <div className="panel__body">
        {volunteers === null ? (
          <Loading label="Carregando aniversários…" />
        ) : people.length === 0 ? (
          <p className="field__hint">Nenhum aniversário nos últimos dias nem nas próximas semanas.</p>
        ) : (
          <ul className="birthday-list">
            {people.map(({ volunteer, day, month, offset }) => (
              <li
                key={volunteer.id}
                className={`birthday-list__item${offset === 0 ? ' birthday-list__item--today' : ''}${offset < 0 ? ' birthday-list__item--passed' : ''}`}
              >
                <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={30} />
                <Link className="row-link birthday-list__name" to={`/voluntarios/${volunteer.id}`}>
                  {volunteer.name}
                </Link>
                {offset === 0 ? (
                  <BirthdayBadge />
                ) : (
                  <span className="birthday-list__day" title={birthdayLabel(day, month) ?? undefined}>
                    {birthdayWhen(day, month, offset)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
