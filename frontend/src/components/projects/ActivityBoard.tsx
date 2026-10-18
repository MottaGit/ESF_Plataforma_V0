import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { activitiesApi, volunteersApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityPriority, ActivityStatus, Volunteer } from '../../types/api';
import { ACTIVITY_PRIORITIES, daysFromToday, dueLabel, formatDate, priorityLabel } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect } from '../ui/Badge';
import { Select, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { IconSearch } from '../ui/Icons';
import { ActivityFormModal } from './ActivityFormModal';

/** Por quantos dias uma concluida continua no quadro (mesmo valor de ActivityService.BoardDoneDays). */
const DONE_DAYS = 30;
/** Prazo dentro desse numero de dias deixa o card com a faixa de "vence em breve". */
const DUE_SOON_DAYS = 7;
/** Valor do filtro de responsavel para atividades sem ninguem atribuido. */
const UNASSIGNED = 'nenhum';

const COLUMNS: Array<{ status: ActivityStatus; title: string; hint?: string }> = [
  { status: 'AFazer', title: 'Não iniciadas' },
  { status: 'EmAndamento', title: 'Em andamento' },
  { status: 'Concluida', title: 'Concluídas', hint: `últimos ${DONE_DAYS} dias` }
];

const PRIORITY_WEIGHT: Record<ActivityPriority, number> = { Alta: 0, Media: 1, Baixa: 2 };

/** Em aberto: prazo mais proximo primeiro (atrasadas no topo, sem prazo no fim), depois maior prioridade. */
function compareOpen(a: Activity, b: Activity) {
  const due = (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
  return due || PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.title.localeCompare(b.title);
}

/** Concluidas: as mais recentes primeiro. */
function compareDone(a: Activity, b: Activity) {
  return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
}

type Urgency = 'late' | 'soon' | null;

/** Atrasada, vencendo nos proximos dias ou sem urgencia (concluidas e sem prazo nunca sao urgentes). */
function urgencyOf(activity: Activity): Urgency {
  if (activity.status === 'Concluida' || !activity.dueDate) return null;
  const days = daysFromToday(activity.dueDate);
  if (days < 0) return 'late';
  return days <= DUE_SOON_DAYS ? 'soon' : null;
}

/** Copia local com o novo status, para o card mudar de coluna antes da resposta do servidor. */
function withStatus(activity: Activity, status: ActivityStatus): Activity {
  return {
    ...activity,
    status,
    completedAt: status === 'Concluida' ? new Date().toISOString() : null,
    isLate: status !== 'Concluida' && Boolean(activity.dueDate) && daysFromToday(activity.dueDate!) < 0
  };
}

/** Busca sem diferenciar maiusculas nem acentos. */
function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Pares [id, nome] sem repeticao, em ordem alfabetica. */
function uniqueOptions(pairs: Array<[string, string]>) {
  return [...new Map(pairs).entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

interface ActivityBoardProps {
  searchParams: URLSearchParams;
  updateParams: (changes: Record<string, string | null>) => void;
  /** Abas "Lista de projetos | Quadro de atividades", logo abaixo do titulo. */
  switcher: ReactNode;
}

/**
 * Quadro de atividades de todos os projetos ativos, em tres colunas por status. Os filtros ficam na URL,
 * assim como na lista de projetos.
 */
export function ActivityBoard({ searchParams, updateParams, switcher }: ActivityBoardProps) {
  const { user } = useAuth();
  const { notify, notifyError } = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);

  const myVolunteerId = user?.volunteerId ?? null;
  const query = searchParams.get('busca') ?? '';
  const mine = searchParams.get('de') === 'minhas' && Boolean(myVolunteerId);
  const projectFilter = searchParams.get('projeto') ?? '';
  const assigneeFilter = mine ? '' : (searchParams.get('responsavel') ?? '');
  const priorityFilter = (searchParams.get('prioridade') ?? '') as ActivityPriority | '';
  const onlyLate = searchParams.get('atrasadas') === '1';

  const [search, setSearch] = useState(query);

  useEffect(() => {
    const timer = window.setTimeout(() => updateParams({ busca: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [search, updateParams]);

  /** silent: recarrega sem trocar o quadro pelo "Carregando" (depois de salvar). */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setActivities(await activitiesApi.board());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as atividades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
  }, []);

  const projectOptions = useMemo(
    () => uniqueOptions(activities.map((activity) => [activity.projectId, activity.projectName ?? 'Projeto'])),
    [activities]
  );

  const assigneeOptions = useMemo(
    () =>
      uniqueOptions(
        activities
          .filter((activity) => activity.assignedVolunteerId)
          .map((activity) => [activity.assignedVolunteerId!, activity.assignedVolunteerName ?? 'Voluntário'])
      ),
    [activities]
  );

  const term = normalize(query.trim());
  const visible = activities.filter((activity) => {
    if (mine && activity.assignedVolunteerId !== myVolunteerId) return false;
    if (projectFilter && activity.projectId !== projectFilter) return false;
    if (assigneeFilter === UNASSIGNED && activity.assignedVolunteerId) return false;
    if (assigneeFilter && assigneeFilter !== UNASSIGNED && activity.assignedVolunteerId !== assigneeFilter) return false;
    if (priorityFilter && activity.priority !== priorityFilter) return false;
    if (onlyLate && urgencyOf(activity) !== 'late') return false;
    if (term && !normalize(`${activity.title} ${activity.projectName ?? ''}`).includes(term)) return false;
    return true;
  });

  const hasFilters = Boolean(term || mine || projectFilter || assigneeFilter || priorityFilter || onlyLate);

  const summary = useMemo(() => {
    const open = activities.filter((activity) => activity.status !== 'Concluida');
    const late = open.filter((activity) => urgencyOf(activity) === 'late').length;
    return { open: open.length, late };
  }, [activities]);

  function clearFilters() {
    setSearch('');
    updateParams({ busca: null, de: null, projeto: null, responsavel: null, prioridade: null, atrasadas: null });
  }

  async function changeStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return;
    const replace = (next: Activity) =>
      setActivities((current) => current.map((item) => (item.id === next.id ? next : item)));

    replace(withStatus(activity, status));
    try {
      replace(await activitiesApi.updateStatus(activity.id, status));
    } catch (err) {
      replace(activity);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a atividade.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Projetos</h1>
          <p className="page-head__desc">
            {summary.open} atividade(s) em aberto nos projetos em planejamento e em andamento
            {summary.late > 0 ? <span className="summary-line__late"> · {summary.late} atrasada(s)</span> : null}
          </p>
        </div>
      </div>

      {switcher}

      <div className="toolbar">
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar atividade ou projeto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar atividades"
          />
        </span>

        <div className="chip-group" role="group" aria-label="De quem">
          <button
            type="button"
            className={`chip${mine ? '' : ' chip--active'}`}
            aria-pressed={!mine}
            onClick={() => updateParams({ de: null })}
          >
            Todas
          </button>
          <button
            type="button"
            className={`chip${mine ? ' chip--active' : ''}`}
            aria-pressed={mine}
            disabled={!myVolunteerId}
            title={myVolunteerId ? undefined : 'Seu acesso não está vinculado a um voluntário.'}
            onClick={() => updateParams({ de: 'minhas', responsavel: null })}
          >
            Minhas
          </button>
        </div>

        <Select
          className="board-filter--project"
          value={projectFilter}
          onChange={(event) => updateParams({ projeto: event.target.value || null })}
          aria-label="Projeto"
        >
          <option value="">Todos os projetos</option>
          {projectOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>

        {!mine ? (
          <Select
            value={assigneeFilter}
            onChange={(event) => updateParams({ responsavel: event.target.value || null })}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            {assigneeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value={UNASSIGNED}>Sem responsável</option>
          </Select>
        ) : null}

        <Select
          value={priorityFilter}
          onChange={(event) => updateParams({ prioridade: event.target.value || null })}
          aria-label="Prioridade"
        >
          <option value="">Todas as prioridades</option>
          {ACTIVITY_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {priorityLabel(value)}
            </option>
          ))}
        </Select>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyLate}
            onChange={(event) => updateParams({ atrasadas: event.target.checked ? '1' : null })}
          />
          Só atrasadas
        </label>

        <div className="toolbar__right">
          {hasFilters ? (
            <button type="button" className="link-button" onClick={clearFilters}>
              Limpar filtros
            </button>
          ) : null}
          {!loading ? (
            <span className="activities__count num">
              {hasFilters ? `${visible.length} de ${activities.length}` : activities.length} atividade(s)
            </span>
          ) : null}
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {loading ? (
        <section className="panel">
          <Loading label="Carregando atividades…" />
        </section>
      ) : activities.length === 0 && !error ? (
        <section className="panel">
          <EmptyState
            title="Nenhuma atividade nos projetos ativos"
            description="As atividades dos projetos em planejamento ou em andamento aparecem aqui, separadas por status."
          />
        </section>
      ) : (
        <div className="board">
          {COLUMNS.map((column) => {
            const cards = visible
              .filter((activity) => activity.status === column.status)
              .sort(column.status === 'Concluida' ? compareDone : compareOpen);

            return (
              <section key={column.status} className="board__col" aria-label={column.title}>
                <header className="board__head">
                  <span>{column.title}</span>
                  {column.hint ? <span className="board__hint">{column.hint}</span> : null}
                  <span className="board__count num">{cards.length}</span>
                </header>

                {cards.length === 0 ? (
                  <p className="board__empty">{hasFilters ? 'Nenhuma atividade com esses filtros.' : 'Nenhuma atividade.'}</p>
                ) : (
                  <div className="board__cards">
                    {cards.map((activity) => (
                      <BoardCard
                        key={activity.id}
                        activity={activity}
                        onOpen={() => setEditing(activity)}
                        onStatusChange={(status) => void changeStatus(activity, status)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editing ? (
        <ActivityFormModal
          projectId={editing.projectId}
          activity={editing}
          volunteers={volunteers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Atividade atualizada.');
            void load(true);
          }}
        />
      ) : null}
    </>
  );
}

interface BoardCardProps {
  activity: Activity;
  onOpen: () => void;
  onStatusChange: (status: ActivityStatus) => void;
}

/** Card da atividade: clicar abre a edicao; o nome do projeto leva para a aba Atividades dele. */
function BoardCard({ activity, onOpen, onStatusChange }: BoardCardProps) {
  const urgency = urgencyOf(activity);
  const done = activity.status === 'Concluida';

  return (
    <article
      className={`board-card${urgency ? ` board-card--${urgency}` : ''}${done ? ' board-card--done' : ''}`}
      onClick={onOpen}
    >
      <div className="board-card__top">
        {/* O clique sobe ate o card; o botao existe para abrir pelo teclado. */}
        <button type="button" className="board-card__title">
          {activity.title}
        </button>
        {activity.priority === 'Alta' && !done ? <span className="badge badge--cancel">Alta</span> : null}
      </div>

      {activity.projectName ? (
        <Link
          className="board-card__project"
          to={`/projetos/${activity.projectId}?aba=atividades`}
          onClick={(event) => event.stopPropagation()}
        >
          {activity.projectName}
        </Link>
      ) : null}

      <div className="board-card__foot">
        {activity.assignedVolunteerName ? (
          <span className="board-card__person">
            <Avatar name={activity.assignedVolunteerName} photoUrl={activity.assignedVolunteerPhotoUrl} size={20} />
            <span className="board-card__name">{activity.assignedVolunteerName}</span>
          </span>
        ) : (
          <span className="board-card__person board-card__person--none">Sem responsável</span>
        )}

        <span
          className={`board-card__due${urgency ? ` board-card__due--${urgency}` : ''}`}
          title={!done && activity.dueDate ? `Prazo: ${formatDate(activity.dueDate)}` : undefined}
        >
          {done
            ? activity.completedAt
              ? `concluída em ${formatDate(activity.completedAt)}`
              : 'concluída'
            : dueLabel(activity.dueDate)}
        </span>
      </div>

      {/* No celular (ou em telas de toque) o status tambem muda pelo selo, alem de arrastar. */}
      <div className="board-card__status" onClick={(event) => event.stopPropagation()}>
        <ActivityStatusSelect status={activity.status} label={`Status de ${activity.title}`} onChange={onStatusChange} />
      </div>
    </article>
  );
}
