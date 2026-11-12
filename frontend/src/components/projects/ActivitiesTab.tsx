import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityKind, ActivityStatus, ProjectDetail, Volunteer } from '../../types/api';
import { ACTIVITY_STATUSES, activityStatusLabel, dueDateTitle, formatDate } from '../../utils/format';
import { ActivityStatusSelect, UrgentBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { VisitBadge } from '../tasks/TaskPeople';
import { dueText, involves, peopleLabel, peopleOf } from '../tasks/taskUtils';
import { ActivityCounters } from './ActivityCounters';
import { ActivityFormModal } from './ActivityFormModal';
import { BlockActivityDialog } from './BlockActivityDialog';

/** Valor do filtro de responsavel (na URL, ?responsavel=sem) para atividades sem ninguem atribuido. */
const UNASSIGNED = 'sem';

/** Secoes da lista: em aberto (nao iniciadas e em andamento juntas) e concluidas, sempre visiveis. */
type Section = 'open' | 'done';

const SECTIONS: Array<{ key: Section; title: string }> = [
  { key: 'open', title: 'Em aberto' },
  { key: 'done', title: 'Concluídas' }
];

/** Ordem dentro de "Em aberto": nao iniciadas, em andamento e, por fim, as bloqueadas. */
const STATUS_ORDER: Record<ActivityStatus, number> = { AFazer: 0, EmAndamento: 1, Bloqueada: 2, Concluida: 3 };

/** Desempate dentro do mesmo status: prazo mais proximo primeiro (sem prazo no fim), depois maior prioridade. */
const PRIORITY_WEIGHT = { Alta: 0, Media: 1, Baixa: 2 } as const;
function compareActivities(a: Activity, b: Activity) {
  const due = (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
  return due !== 0 ? due : PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
}

interface ActivitiesTabProps {
  project: ProjectDetail;
  volunteers: Volunteer[];
  /** Filtros "so atrasadas" e de responsavel ficam na URL para poder chegar aqui ja filtrado (ex.: aba Equipe). */
  onlyLate: boolean;
  assignee: string;
  onUrlFiltersChange: (filters: { onlyLate: boolean; assignee: string }) => void;
  onChanged: () => void;
}

export function ActivitiesTab({
  project,
  volunteers,
  onlyLate,
  assignee: assigneeFilter,
  onUrlFiltersChange,
  onChanged
}: ActivitiesTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  /** A tarefa abre para ler; "Editar" no menu abre direto no formulario. */
  const [formMode, setFormMode] = useState<'view' | 'edit'>('view');
  // "Nova visita" abre o mesmo formulario, ja no tipo visita.
  const [newKind, setNewKind] = useState<ActivityKind>('Tarefa');
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [blocking, setBlocking] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);

  // Link direto para uma tarefa (aviso do sininho, busca): abre a janela dela e tira o parametro da URL.
  // "atividade" e o nome antigo do parametro, que links ja enviados ainda usam.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedActivityId = searchParams.get('tarefa') ?? searchParams.get('atividade');
  // Aviso de comentario: a janela abre ja nos comentarios.
  const [focusComments, setFocusComments] = useState(false);
  useEffect(() => {
    if (!linkedActivityId) return;
    const linked = project.activities.find((activity) => activity.id === linkedActivityId);
    if (linked) {
      setEditing(linked);
      setFormMode('view');
      setFocusComments(searchParams.get('comentarios') === '1');
      setFormOpen(true);
    } else {
      // Link antigo (aviso, busca) de uma tarefa que ja foi excluida: explica em vez de nao fazer nada.
      notify('Essa tarefa não existe mais: foi excluída do projeto.');
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('tarefa');
        next.delete('atividade');
        next.delete('comentarios');
        return next;
      },
      { replace: true }
    );
    // So ao chegar com o link (os parametros saem da URL logo em seguida).
    // A lista de tarefas entra para achar a tarefa quando o projeto termina de carregar.
  }, [linkedActivityId, project.activities, setSearchParams]);

  const [statusFilter, setStatusFilter] = useState<ActivityStatus | ''>('');

  // Status de cada atividade quando ela apareceu nesta visita a aba. Concluir (ou reabrir) nao tira a
  // atividade da secao em que estava: ela fica riscada no lugar e so muda de secao quando a aba e
  // aberta de novo. Ja trocar entre "nao iniciada" e "em andamento" reordena a lista na hora.
  const firstSeen = useRef(new Map<string, ActivityStatus>());
  function statusWhenSeen(activity: Activity) {
    if (!firstSeen.current.has(activity.id)) firstSeen.current.set(activity.id, activity.status);
    return firstSeen.current.get(activity.id)!;
  }

  function sectionOf(activity: Activity): Section {
    return statusWhenSeen(activity) === 'Concluida' ? 'done' : 'open';
  }

  // Status anterior das atividades concluidas nesta visita, para o "Desfazer".
  const [undo, setUndo] = useState<Map<string, ActivityStatus>>(new Map());

  /** Em "Em aberto", quem acabou de ser concluida fica na posicao do status que tinha antes. */
  function compareOpen(a: Activity, b: Activity) {
    const rank = (activity: Activity) =>
      STATUS_ORDER[
        activity.status === 'Concluida' ? (undo.get(activity.id) ?? statusWhenSeen(activity)) : activity.status
      ];
    return rank(a) - rank(b) || compareActivities(a, b);
  }

  const activities = project.activities;
  const hasFilters = Boolean(statusFilter || assigneeFilter || onlyLate);

  // Responsaveis que aparecem nas atividades do projeto, para o filtro.
  const assignees = useMemo(() => {
    const byId = new Map<string, string>();
    activities.forEach((activity) => peopleOf(activity).forEach((person) => byId.set(person.id, person.name)));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const visible = activities.filter((activity) => {
    if (statusFilter && activity.status !== statusFilter) return false;
    if (onlyLate && !activity.isLate) return false;
    if (assigneeFilter === UNASSIGNED) return !activity.assignedVolunteerId;
    if (assigneeFilter && !involves(activity, assigneeFilter)) return false;
    return true;
  });

  function clearFilters() {
    setStatusFilter('');
    onUrlFiltersChange({ onlyLate: false, assignee: '' });
  }

  function forgetUndo(id: string) {
    setUndo((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  function openForm(activity: Activity | null, mode: 'view' | 'edit' = 'view', kind: ActivityKind = 'Tarefa') {
    setEditing(activity);
    setNewKind(kind);
    setFormMode(mode);
    setFormOpen(true);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null = null) {
    if (activity.status === status) return true;
    try {
      await activitiesApi.updateStatus(activity.id, status, blockedReason);
      onChanged();
      return true;
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a tarefa.');
      return false;
    }
  }

  /** Caixinha: concluir guarda o status anterior; desmarcar (ou "Desfazer") volta para ele. */
  async function toggleDone(activity: Activity, done: boolean) {
    if (done) {
      const previous = activity.status;
      setUndo((current) => new Map(current).set(activity.id, previous));
      const saved = await changeStatus(activity, 'Concluida');
      if (!saved) forgetUndo(activity.id);
      return saved;
    }

    const target = undo.get(activity.id) ?? 'AFazer';
    forgetUndo(activity.id);
    return changeStatus(activity, target);
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await activitiesApi.remove(removing.id);
      notify('Tarefa excluída.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir a tarefa.');
    } finally {
      setBusy(false);
    }
  }

  const doneCount = activities.filter((activity) => activity.status === 'Concluida').length;

  return (
    <>
      <div className="toolbar">
        {activities.length > 0 ? (
          <>
            <Select
              value={statusFilter}
              aria-label="Filtrar por status"
              onChange={(event) => setStatusFilter(event.target.value as ActivityStatus | '')}
            >
              <option value="">Todos os status</option>
              {ACTIVITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {activityStatusLabel(value)}
                </option>
              ))}
            </Select>

            <Select
              value={assigneeFilter}
              aria-label="Filtrar por responsável"
              onChange={(event) => onUrlFiltersChange({ onlyLate, assignee: event.target.value })}
            >
              <option value="">Todos os responsáveis</option>
              {assignees.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              <option value={UNASSIGNED}>Sem responsável</option>
            </Select>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={onlyLate}
                onChange={(event) => onUrlFiltersChange({ onlyLate: event.target.checked, assignee: assigneeFilter })}
              />
              Só atrasadas
            </label>
          </>
        ) : null}

        <div className="toolbar__right">
          {activities.length > 0 ? (
            <span className="activities__count num">
              {doneCount} de {activities.length} concluídas
              {hasFilters ? ` · mostrando ${visible.length}` : ''}
            </span>
          ) : null}
          <Button small icon={<IconPlus size={15} />} onClick={() => openForm(null, 'view', 'Visita')}>
            Nova visita
          </Button>
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => openForm(null)}>
            Nova tarefa
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma tarefa registrada"
            description="Quebre o projeto em tarefas para acompanhar a execução e distribuir responsáveis."
            action={
              <Button variant="primary" onClick={() => openForm(null)}>
                Criar primeira tarefa
              </Button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma tarefa com esses filtros"
            description="Ajuste os filtros para ver as demais tarefas do projeto."
            action={<Button onClick={clearFilters}>Limpar filtros</Button>}
          />
        </div>
      ) : (
        SECTIONS.map((section) => {
          const items = visible
            .filter((activity) => sectionOf(activity) === section.key)
            .sort(section.key === 'open' ? compareOpen : compareActivities);
          if (items.length === 0) return null;

          return (
            <section className="act-group" key={section.key}>
              <h3 className="act-group__title">
                {section.title}
                <span className="tab__count num">{items.length}</span>
              </h3>
              <ul className="panel act-list">
                {items.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    canUndo={undo.has(activity.id) && activity.status === 'Concluida'}
                    onOpen={() => openForm(activity)}
                    onToggleDone={(done) => toggleDone(activity, done)}
                    onStatusChange={(status) => {
                      forgetUndo(activity.id);
                      // Bloquear pergunta antes o que esta travando.
                      if (status === 'Bloqueada') setBlocking(activity);
                      else void changeStatus(activity, status);
                    }}
                    onEdit={() => openForm(activity, 'edit')}
                    onRemove={() => setRemoving(activity)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {formOpen ? (
        <ActivityFormModal
          projectId={project.id}
          activity={editing}
          initialMode={formMode}
          team={project.volunteers}
          volunteers={volunteers}
          focusComments={focusComments}
          initialKind={newKind}
          onClose={() => {
            setFormOpen(false);
            setFocusComments(false);
          }}
          onSaved={() => {
            setFormOpen(false);
            setFocusComments(false);
            onChanged();
          }}
          onExtrasChanged={onChanged}
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

      {removing ? (
        <ConfirmDialog
          title="Excluir tarefa"
          message={`A tarefa "${removing.title}" será removida do projeto.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

interface ActivityRowProps {
  activity: Activity;
  /** Concluida nesta visita a aba: mostra o "Desfazer". */
  canUndo: boolean;
  /** Abre a janela da tarefa. */
  onOpen: () => void;
  /** Resolve com false quando a alteracao nao foi salva. */
  onToggleDone: (done: boolean) => Promise<boolean>;
  onStatusChange: (status: ActivityStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}

function ActivityRow({
  activity,
  canUndo,
  onOpen,
  onToggleDone,
  onStatusChange,
  onEdit,
  onRemove
}: ActivityRowProps) {
  // A caixinha responde na hora; se o servidor recusar, volta ao estado salvo.
  const [checkedNow, setCheckedNow] = useState<boolean | null>(null);
  const done = activity.status === 'Concluida';
  const checked = checkedNow ?? done;

  useEffect(() => setCheckedNow(null), [activity.status]);

  async function toggle(value: boolean) {
    setCheckedNow(value);
    const saved = await onToggleDone(value);
    if (!saved) setCheckedNow(null);
  }

  return (
    <li className={`act-row${checked ? ' act-row--done' : ''}`}>
      <label className="check-hit" title={checked ? 'Reabrir tarefa' : 'Marcar como concluída'}>
        <input
          type="checkbox"
          className="act-row__check"
          checked={checked}
          aria-label={checked ? `Reabrir "${activity.title}"` : `Concluir "${activity.title}"`}
          onChange={(event) => void toggle(event.target.checked)}
        />
      </label>

      <div className="act-row__main">
        <button type="button" className="act-row__title" onClick={onOpen}>
          {activity.title}
        </button>
        <div className="act-row__meta">
          <VisitBadge activity={activity} />
          <span>{peopleLabel(activity)}</span>
          <span
            className={activity.isLate ? 'act-row__due--late' : undefined}
            title={done || activity.kind === 'Visita' ? undefined : dueDateTitle(activity.dueDate)}
          >
            {done
              ? activity.completedAt
                ? `concluída em ${formatDate(activity.completedAt)}`
                : 'concluída'
              : dueText(activity)}
          </span>
          {!done ? <UrgentBadge priority={activity.priority} /> : null}
          <ActivityCounters activity={activity} onClick={onOpen} />
          {canUndo ? (
            <button type="button" className="act-row__undo" onClick={() => void toggle(false)}>
              Desfazer
            </button>
          ) : null}
        </div>
        {activity.status === 'Bloqueada' && activity.blockedReason ? (
          <p className="act-row__blocked">{activity.blockedReason}</p>
        ) : null}
      </div>

      <div className="act-row__side">
        <ActivityStatusSelect status={activity.status} label={`Status de ${activity.title}`} onChange={onStatusChange} />
        <Menu
          label="Ações da tarefa"
          items={[
            { label: 'Editar', icon: <IconEdit size={14} />, onSelect: onEdit },
            { label: 'Excluir', icon: <IconTrash size={14} />, danger: true, onSelect: onRemove }
          ]}
        />
      </div>
    </li>
  );
}
