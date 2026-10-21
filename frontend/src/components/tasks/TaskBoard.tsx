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
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Activity, ActivityStatus } from '../../types/api';
import { dueDateLabel, dueDateTitle, formatDate } from '../../utils/format';
import { ActivityCounters } from '../projects/ActivityCounters';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect } from '../ui/Badge';
import { DONE_DAYS, compareDone, compareOpen, isOverdue } from './taskUtils';

const COLUMNS: Array<{ status: ActivityStatus; title: string; hint?: string }> = [
  { status: 'AFazer', title: 'Não iniciadas' },
  { status: 'EmAndamento', title: 'Em andamento' },
  { status: 'Bloqueada', title: 'Bloqueadas' },
  { status: 'Concluida', title: 'Concluídas', hint: `últimos ${DONE_DAYS} dias` }
];

/** Coluna sob o ponteiro (ou o dedo); fora de todas, a que mais cobre o card arrastado. */
const detectColumn: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

interface TaskBoardProps {
  /** Tarefas ja filtradas pela tela. */
  activities: Activity[];
  hasFilters: boolean;
  onOpen: (activity: Activity) => void;
  /** Bloquear pergunta o motivo antes (quem chama decide). */
  onRequestStatus: (activity: Activity, status: ActivityStatus) => void;
}

/**
 * Quadro de tarefas em quatro colunas por status. Arrastar um card para outra coluna muda o status; no celular,
 * segurar o card antes de arrastar (ou usar o selo de status).
 */
export function TaskBoard({ activities, hasFilters, onOpen, onRequestStatus }: TaskBoardProps) {
  const [dragging, setDragging] = useState<Activity | null>(null);

  const sensors = useSensors(
    // Mouse: o arraste so comeca depois de mover alguns pixels, entao um clique simples abre o card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Toque: segurar o card um instante antes de arrastar; deslizar o dedo direto continua rolando a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setDragging(activities.find((activity) => activity.id === event.active.id) ?? null);
  }

  /** Soltar numa coluna muda o status (na mesma coluna, nada acontece). */
  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const activity = activities.find((item) => item.id === event.active.id);
    const status = event.over?.id as ActivityStatus | undefined;
    if (activity && status && activity.status !== status) onRequestStatus(activity, status);
  }

  return (
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
            const cards = activities
              .filter((activity) => activity.status === column.status)
              .sort(column.status === 'Concluida' ? compareDone : compareOpen);

            return (
              <BoardColumn key={column.status} {...column} count={cards.length}>
                {cards.length === 0 ? (
                  <p className="board__empty">{hasFilters ? 'Nenhuma tarefa com esses filtros.' : 'Nenhuma tarefa.'}</p>
                ) : (
                  <div className="board__cards">
                    {cards.map((activity) => (
                      <DraggableCard
                        key={activity.id}
                        activity={activity}
                        onOpen={() => onOpen(activity)}
                        onStatusChange={(status) => onRequestStatus(activity, status)}
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
        Arraste um card para outra coluna para mudar o status (no celular, segure o card antes de arrastar ou use o
        selo de status). Clique no card para abrir a tarefa.
      </p>
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

/** Card da tarefa: clicar abre a tarefa; o nome do projeto leva para as tarefas dele. */
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
          to={`/projetos/${activity.projectId}?aba=tarefas`}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
        >
          {activity.projectName}
        </Link>
      ) : null}

      {activity.status === 'Bloqueada' && activity.blockedReason ? (
        <p className="board-card__blocked">{activity.blockedReason}</p>
      ) : null}

      <ActivityCounters activity={activity} />

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
