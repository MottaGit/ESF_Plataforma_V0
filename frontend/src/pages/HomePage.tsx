import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  activitiesApi,
  dashboardApi,
  filesApi,
  projectUpdatesApi,
  projectsApi,
  volunteersApi
} from '../api/endpoints';
import { TermCallout } from '../components/documents/MyTermPanel';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ActivityCounters } from '../components/projects/ActivityCounters';
import { ActivityFormModal } from '../components/projects/ActivityFormModal';
import { groupByDue } from '../components/tasks/TaskList';
import { isOverdue, useJustDone } from '../components/tasks/taskUtils';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge } from '../components/ui/Badge';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { IconCheck, IconChevronRight } from '../components/ui/Icons';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { keepForOffline } from '../offline/offline';
import type { Activity, Dashboard, HomeProject, IdleVolunteer, SetupStatus, Volunteer } from '../types/api';
import {
  UNLINKED_MESSAGE,
  birthdayLabel,
  birthdayOffset,
  displayName,
  dueDateLabel,
  dueDateTitle,
  timeAgoPhrase
} from '../utils/format';

/** Quantas das minhas tarefas aparecem no Inicio (o resto fica em Tarefas). */
const MY_TASKS_VISIBLE = 8;

/** Quantas pessoas sem tarefa aparecem antes do "Ver todas". */
const IDLE_VISIBLE = 6;

/** Janela de aniversarios: os que passaram ha poucos dias e os que vem pela frente. */
const BIRTHDAYS_DAYS_BACK = 5;
const BIRTHDAYS_DAYS_AHEAD = 14;

/** "1 tarefa" / "3 tarefas" e afins. */
function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Inicio: o que a pessoa logada tem para fazer (as tarefas e os projetos dela) e os aniversarios. A coordenacao ve
 * tambem o resumo da organizacao e quem esta sem tarefa; a administracao de um nucleo que esta comecando, os primeiros
 * passos.
 */
export function HomePage() {
  const { user, canManage, isAdmin } = useAuth();

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

  // Os projetos da pessoa ficam guardados no aparelho para consultar em campo, mesmo os que ela nao abriu: o projeto,
  // a primeira pagina do Andamento e os arquivos (as mesmas chamadas que as abas fazem).
  useEffect(() => {
    data?.myProjects.forEach((project) =>
      keepForOffline(`project:${project.id}`, () =>
        Promise.all([
          projectsApi.get(project.id),
          projectUpdatesApi.listByProject(project.id),
          filesApi.listByProject(project.id)
        ])
      )
    );
  }, [data]);

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

      <TermCallout volunteerId={user?.volunteerId ?? null} />

      {isAdmin && data.setup ? <FirstSteps setup={data.setup} /> : null}

      {canManage && !data.setup ? <OrgStrip data={data} /> : null}

      <div className="grid-sidebar home">
        <div className="home__col">
          <MyTasksPanel tasks={data.myTasks} total={data.mine?.open ?? 0} onOpen={setOpened} onChanged={() => void load(true)} />
          {canManage ? <IdlePanel people={data.idle} /> : null}
        </div>

        <div className="home__col">
          <MyProjectsPanel projects={data.myProjects} />
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

/**
 * Primeiros passos de um nucleo novo (so a administracao ve): cada passo se marca sozinho quando e feito, e o quadro
 * some quando o primeiro projeto e criado.
 */
function FirstSteps({ setup }: { setup: SetupStatus }) {
  const steps = [
    {
      done: setup.organizationDone,
      title: 'Complete os dados do núcleo',
      hint: 'CNPJ, quem assina os termos e certificados e o logo dos relatórios.',
      to: '/configuracoes?aba=organizacao',
      action: 'Abrir dados'
    },
    {
      done: setup.programDone,
      title: 'Crie um programa',
      hint: 'Agrupa os projetos do mesmo tipo (ex.: banheiros, hortas). Em Projetos, botão "Novo programa".',
      to: '/projetos',
      action: 'Ir para Projetos'
    },
    {
      done: setup.teamDone,
      title: 'Cadastre a equipe e dê acesso',
      hint: 'Cadastre os voluntários e, na página de cada um, use "Dar acesso" para mandar o link.',
      to: '/voluntarios',
      action: 'Ir para Voluntários'
    },
    {
      done: false,
      title: 'Crie o primeiro projeto',
      hint: 'Com ele criado, este quadro sai do Início.',
      to: '/projetos?novo=1',
      action: 'Novo projeto'
    }
  ];

  return (
    <section className="panel first-steps" aria-label="Primeiros passos">
      <div className="panel__head">
        <h2>Primeiros passos</h2>
        <span className="field__hint">O núcleo está começando: estes passos deixam tudo pronto para o primeiro projeto.</span>
      </div>
      <ol className="first-steps__list">
        {steps.map((step, index) => (
          <li key={step.title} className={`first-steps__item${step.done ? ' first-steps__item--done' : ''}`}>
            <span className="first-steps__mark" aria-hidden="true">
              {step.done ? <IconCheck size={14} /> : index + 1}
            </span>
            <span className="first-steps__text">
              <span className="first-steps__title">
                {step.title}
                {step.done ? <span className="sr-only"> (feito)</span> : null}
              </span>
              <span className="field__hint">{step.hint}</span>
            </span>
            {!step.done ? (
              <Link className="btn btn--sm" to={step.to}>
                {step.action}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Coordenacao: o que pede atencao na organizacao. Cada numero abre a lista correspondente (a setinha no canto). */
function OrgStrip({ data }: { data: Dashboard }) {
  const { org } = data;
  const tiles = [
    { to: '/tarefas?de=todas&recorte=atrasadas', value: org.lateTasks, label: 'Tarefas atrasadas', alert: org.lateTasks > 0 },
    { to: '/tarefas?de=todas&recorte=bloqueadas', value: org.blockedTasks, label: 'Tarefas bloqueadas', alert: false },
    { to: '/projetos?parados=1', value: org.staleProjects, label: 'Projetos parados', hint: 'sem registro há 30 dias', alert: false }
  ];
  return (
    <section className="section" aria-label="Na organização">
      <h2 className="home__label">Na organização</h2>
      <div className="stat-strip">
        {tiles.map((tile) => (
          <Link key={tile.label} className="stat stat--link" to={tile.to}>
            <span className="stat__go" aria-hidden="true">
              <IconChevronRight size={16} />
            </span>
            <div className={`stat__value num${tile.alert ? ' stat__value--alert' : ''}`}>{tile.value}</div>
            <div className="stat__label">{tile.label}</div>
            {tile.hint ? <div className="stat__hint">{tile.hint}</div> : null}
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
  const { notifyError } = useToast();
  // Concluidas nesta visita: ficam riscadas no lugar, com "Desfazer", mesmo depois que a lista recarrega (a API so
  // manda as em aberto). Igual em Tarefas e na aba do projeto.
  const justDone = useJustDone();
  const linked = Boolean(user?.volunteerId);

  async function complete(activity: Activity) {
    justDone.remember(activity);
    try {
      await activitiesApi.updateStatus(activity.id, 'Concluida');
      onChanged();
    } catch (err) {
      justDone.forget(activity.id);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível concluir a tarefa.');
    }
  }

  /** Desmarcar ou "Desfazer": volta ao status de antes (com o motivo, se estava bloqueada). */
  async function reopen(activity: Activity) {
    const before = justDone.before.get(activity.id) ?? activity;
    justDone.forget(activity.id);
    try {
      await activitiesApi.updateStatus(activity.id, before.status, before.blockedReason ?? null);
      onChanged();
    } catch (err) {
      justDone.remember(before);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível reabrir a tarefa.');
    }
  }

  // As recem-concluidas voltam para a lista (riscadas), no grupo em que estavam.
  const shown: Activity[] = [
    ...tasks.filter((activity) => !justDone.before.has(activity.id)),
    ...[...justDone.before.values()].map((activity) => ({ ...activity, status: 'Concluida' as const }))
  ];

  // Grupos por prazo, cortados nas primeiras MY_TASKS_VISIBLE tarefas.
  let budget = MY_TASKS_VISIBLE;
  const groups = groupByDue(shown, justDone.before)
    .map((group) => {
      const items = group.items.slice(0, Math.max(budget, 0));
      budget -= items.length;
      return { ...group, total: group.items.length, items };
    })
    .filter((group) => group.items.length > 0);
  const openShown = groups.reduce(
    (sum, group) => sum + group.items.filter((activity) => !justDone.before.has(activity.id)).length,
    0
  );
  const hidden = total - openShown;

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
                  const checked = justDone.before.has(activity.id);
                  return (
                    <li key={activity.id} className={`task-row${checked ? ' task-row--done' : ''}`}>
                      <label className="check-hit" title={checked ? 'Reabrir tarefa' : 'Marcar como concluída'}>
                        <input
                          type="checkbox"
                          className="task-row__check"
                          checked={checked}
                          aria-label={checked ? `Reabrir "${activity.title}"` : `Concluir "${activity.title}"`}
                          onChange={(event) =>
                            void (event.target.checked ? complete(activity) : reopen(activity))
                          }
                        />
                      </label>
                      <button type="button" className="task-row__main" onClick={() => onOpen(activity)}>
                        <span className="task-row__title">{activity.title}</span>
                        <span className="task-row__meta">
                          <span className="task-row__project-wrap">
                            {activity.programIcon && activity.programColor ? (
                              <ProgramMark icon={activity.programIcon} color={activity.programColor} size={16} />
                            ) : null}
                            <span className="task-row__project">{activity.projectName}</span>
                          </span>
                          <ActivityCounters activity={activity} />
                        </span>
                      </button>
                      {checked ? (
                        <button type="button" className="task-row__undo" onClick={() => void reopen(activity)}>
                          Desfazer
                        </button>
                      ) : activity.status === 'Bloqueada' ? (
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
                {project.tasks === 0 && project.status !== 'Concluido' ? null : <Progress value={project.progress} />}
                <span className="field__hint">
                  {project.tasks === 0 && project.status !== 'Concluido' ? 'sem tarefas · ' : ''}
                  {lastUpdateLabel(project)}
                </span>
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

/**
 * Coordenacao: voluntarios ativos sem nenhuma tarefa em aberto, para chamar quem esta parado. Quem nao esta em nenhum
 * projeto vem primeiro (a API ja manda nessa ordem).
 */
function IdlePanel({ people }: { people: IdleVolunteer[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? people : people.slice(0, IDLE_VISIBLE);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Quem está sem tarefa</h2>
        {people.length > 0 ? <span className="tab__count num">{people.length}</span> : null}
      </div>
      <div className="panel__body">
        {people.length === 0 ? (
          <p className="field__hint">Todos os voluntários ativos têm alguma tarefa em aberto.</p>
        ) : (
          <>
            <ul className="idle-list">
              {shown.map((person) => (
                <li key={person.volunteerId} className="idle-list__item">
                  <Avatar name={person.name} photoUrl={person.photoUrl} size={28} />
                  <Link className="row-link idle-list__name" to={`/voluntarios/${person.volunteerId}`}>
                    {person.name}
                  </Link>
                  <span className="idle-list__projects">
                    {person.projects === 0 ? 'sem projeto' : `em ${plural(person.projects, 'projeto', 'projetos')}`}
                  </span>
                </li>
              ))}
            </ul>
            {people.length > IDLE_VISIBLE ? (
              <button type="button" className="link-button idle-list__more" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Mostrar menos' : `Ver todas as ${people.length} pessoas`}
              </button>
            ) : null}
          </>
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
 * Aniversariantes dos ultimos 5 dias e dos proximos 14 (pela data local de quem esta usando), so de quem
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

  // Sem ninguem na janela (ou ainda carregando), o bloco nem aparece.
  if (people.length === 0) return null;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Aniversariantes</h2>
      </div>
      <div className="panel__body">
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
      </div>
    </section>
  );
}
