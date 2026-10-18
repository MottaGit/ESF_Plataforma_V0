import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableSyntheticListeners
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { activitiesApi, projectsApi, volunteersApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityPriority, ActivityStatus, Volunteer } from '../../types/api';
import {
  ACTIVITY_PRIORITIES,
  daysFromToday,
  dueDateLabel,
  dueDateTitle,
  formatDate,
  priorityLabel
} from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { IconPlus, IconSearch } from '../ui/Icons';
import { ActivityFormModal } from './ActivityFormModal';
import { BlockActivityDialog } from './BlockActivityDialog';

/** Por quantos dias uma concluida continua no quadro (mesmo valor de ActivityService.BoardDoneDays). */
const DONE_DAYS = 30;
/** Valor do filtro de responsavel para atividades sem ninguem atribuido. */
const UNASSIGNED = 'nenhum';

const COLUMNS: Array<{ status: ActivityStatus; title: string; hint?: string }> = [
  { status: 'AFazer', title: 'Não iniciadas' },
  { status: 'EmAndamento', title: 'Em andamento' },
  { status: 'Bloqueada', title: 'Bloqueadas' },
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

/** Prazo vencido (concluidas e atividades sem prazo nunca estao atrasadas). */
function isOverdue(activity: Activity) {
  return activity.status !== 'Concluida' && Boolean(activity.dueDate) && daysFromToday(activity.dueDate!) < 0;
}

/** Copia local com o novo status, para o card mudar de coluna antes da resposta do servidor. */
function withStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null): Activity {
  return {
    ...activity,
    status,
    blockedReason: status === 'Bloqueada' ? blockedReason : null,
    completedAt: status === 'Concluida' ? new Date().toISOString() : null,
    isLate: status !== 'Concluida' && Boolean(activity.dueDate) && daysFromToday(activity.dueDate!) < 0
  };
}

/** Coluna sob o ponteiro (ou o dedo); fora de todas, a que mais cobre o card arrastado. */
const detectColumn: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

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
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<Activity | null>(null);
  /** Atividade esperando o motivo do bloqueio (arrastada ou trocada para "Bloqueada"). */
  const [blocking, setBlocking] = useState<Activity | null>(null);
  /** Projetos que aparecem no quadro (planejamento ou andamento): opcoes para criar uma atividade. */
  const [activeProjects, setActiveProjects] = useState<Array<{ id: string; name: string }>>([]);

  const sensors = useSensors(
    // Mouse: o arraste so comeca depois de mover alguns pixels, entao um clique simples abre o card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Toque: segurar o card um instante antes de arrastar; deslizar o dedo direto continua rolando a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

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
    projectsApi
      .list({ sort: 'name' })
      .then((list) =>
        setActiveProjects(
          list
            .filter((project) => project.status === 'Planejamento' || project.status === 'EmAndamento')
            .map((project) => ({ id: project.id, name: project.name }))
        )
      )
      .catch(() => undefined);
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
    if (onlyLate && !isOverdue(activity)) return false;
    if (term && !normalize(`${activity.title} ${activity.projectName ?? ''}`).includes(term)) return false;
    return true;
  });

  const hasFilters = Boolean(term || mine || projectFilter || assigneeFilter || priorityFilter || onlyLate);

  const summary = useMemo(() => {
    const open = activities.filter((activity) => activity.status !== 'Concluida');
    const late = open.filter((activity) => isOverdue(activity)).length;
    return { open: open.length, late };
  }, [activities]);

  function clearFilters() {
    setSearch('');
    updateParams({ busca: null, de: null, projeto: null, responsavel: null, prioridade: null, atrasadas: null });
  }

  /** Bloquear pergunta antes o que esta travando; os demais status mudam direto. */
  function requestStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return;
    if (status === 'Bloqueada') setBlocking(activity);
    else void changeStatus(activity, status);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null = null) {
    const replace = (next: Activity) =>
      setActivities((current) => current.map((item) => (item.id === next.id ? next : item)));

    replace(withStatus(activity, status, blockedReason));
    try {
      replace(await activitiesApi.updateStatus(activity.id, status, blockedReason));
    } catch (err) {
      replace(activity);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a atividade.');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(activities.find((activity) => activity.id === event.active.id) ?? null);
  }

  /** Soltar numa coluna muda o status (na mesma coluna, nada acontece). */
  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const activity = activities.find((item) => item.id === event.active.id);
    const status = event.over?.id as ActivityStatus | undefined;
    if (activity && status) requestStatus(activity, status);
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
        <div className="page-head__actions">
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            Nova atividade
          </Button>
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
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={detectColumn}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <div className="board">
              {COLUMNS.map((column) => {
                const cards = visible
                  .filter((activity) => activity.status === column.status)
                  .sort(column.status === 'Concluida' ? compareDone : compareOpen);

                return (
                  <BoardColumn key={column.status} {...column} count={cards.length}>
                    {cards.length === 0 ? (
                      <p className="board__empty">
                        {hasFilters ? 'Nenhuma atividade com esses filtros.' : 'Nenhuma atividade.'}
                      </p>
                    ) : (
                      <div className="board__cards">
                        {cards.map((activity) => (
                          <DraggableCard
                            key={activity.id}
                            activity={activity}
                            onOpen={() => setEditing(activity)}
                            onStatusChange={(status) => requestStatus(activity, status)}
                          />
                        ))}
                      </div>
                    )}
                  </BoardColumn>
                );
              })}
            </div>

            {/* O card muda de coluna assim que e solto, entao nao ha animacao de volta. */}
            <DragOverlay dropAnimation={null}>{dragging ? <BoardCard activity={dragging} overlay /> : null}</DragOverlay>
          </DndContext>

          <p className="field__hint board__tip">
            Arraste um card para outra coluna para mudar o status (no celular, segure o card antes de arrastar ou use
            o selo de status). Clique no card para editar a atividade.
          </p>
        </>
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

      {blocking ? (
        <BlockActivityDialog
          title={blocking.title}
          onCancel={() => setBlocking(null)}
          onConfirm={(reason) => {
            setBlocking(null);
            void changeStatus(blocking, 'Bloqueada', reason);
          }}
        />
      ) : null}

      {creating ? (
        <ActivityFormModal
          // Filtrando por um projeto, ele ja vem escolhido.
          projectId={activeProjects.some((project) => project.id === projectFilter) ? projectFilter : ''}
          projects={activeProjects}
          activity={null}
          volunteers={volunteers}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify('Atividade criada.');
            void load(true);
          }}
        />
      ) : null}
    </>
  );
}

interface BoardColumnProps {
  status: ActivityStatus;
  title: string;
  hint?: string;
  count: number;
  children: ReactNode;
}

/** Coluna que recebe os cards soltos; fica destacada enquanto um card de outra coluna passa por cima. */
function BoardColumn({ status, title, hint, count, children }: BoardColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: status });
  const highlighted = isOver && active?.data.current?.status !== status;

  return (
    <section ref={setNodeRef} className={`board__col${highlighted ? ' board__col--over' : ''}`} aria-label={title}>
      <header className="board__head">
        <span>{title}</span>
        {hint ? <span className="board__hint">{hint}</span> : null}
        <span className="board__count num">{count}</span>
      </header>
      {children}
    </section>
  );
}

interface BoardCardProps {
  activity: Activity;
  onOpen?: () => void;
  onStatusChange?: (status: ActivityStatus) => void;
  /** Copia que acompanha o ponteiro durante o arraste. */
  overlay?: boolean;
  cardRef?: (element: HTMLElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  /** O card original, enquanto a copia esta sendo arrastada. */
  dragging?: boolean;
}

function DraggableCard(props: BoardCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: props.activity.id,
    data: { status: props.activity.status }
  });
  return <BoardCard {...props} cardRef={setNodeRef} listeners={listeners} dragging={isDragging} />;
}

/** Card da atividade: clicar abre a edicao; o nome do projeto leva para a aba Atividades dele. */
function BoardCard({ activity, onOpen, onStatusChange, overlay, cardRef, listeners, dragging }: BoardCardProps) {
  const done = activity.status === 'Concluida';
  const modifiers = [
    done ? ' board-card--done' : '',
    overlay ? ' board-card--overlay' : '',
    dragging ? ' board-card--dragging' : ''
  ].join('');

  return (
    <article ref={cardRef} className={`board-card${modifiers}`} onClick={onOpen} {...listeners}>
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
          draggable={false}
          onClick={(event) => event.stopPropagation()}
        >
          {activity.projectName}
        </Link>
      ) : null}

      {activity.status === 'Bloqueada' && activity.blockedReason ? (
        <p className="board-card__blocked">{activity.blockedReason}</p>
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
          className={`board-card__due${!done && isOverdue(activity) ? ' board-card__due--late' : ''}`}
          title={done ? undefined : dueDateTitle(activity.dueDate)}
        >
          {done
            ? activity.completedAt
              ? `concluída em ${formatDate(activity.completedAt)}`
              : 'concluída'
            : dueDateLabel(activity.dueDate)}
        </span>
      </div>

      {/* No celular (e em telas de toque) o status tambem muda pelo selo, alem de arrastar. Tocar nele
          nao abre o card nem comeca um arraste. */}
      <div
        className="board-card__status"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <ActivityStatusSelect
          status={activity.status}
          label={`Status de ${activity.title}`}
          onChange={(status) => onStatusChange?.(status)}
        />
      </div>
    </article>
  );
}
