import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityStatus, ProjectDetail, Volunteer } from '../../types/api';
import { ACTIVITY_STATUSES, activityStatusLabel, dueLabel, formatDate, formatDateTime } from '../../utils/format';
import { ActivityStatusSelect, PriorityBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select, TextInput } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { ActivityFormModal } from './ActivityFormModal';

/** Valor do filtro de responsavel para atividades sem ninguem atribuido. */
const UNASSIGNED = '__none__';

/** Ordem dos grupos na tela: o que esta em execucao primeiro, concluidas por ultimo (recolhidas). */
const GROUPS: Array<{ status: ActivityStatus; title: string }> = [
  { status: 'EmAndamento', title: 'Em andamento' },
  { status: 'AFazer', title: 'A fazer' },
  { status: 'Concluida', title: 'Concluídas' }
];

/** Dentro de cada grupo: prazo mais proximo primeiro (sem prazo no fim), depois maior prioridade. */
const PRIORITY_WEIGHT = { Alta: 0, Media: 1, Baixa: 2 } as const;
function compareActivities(a: Activity, b: Activity) {
  const due = (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
  return due !== 0 ? due : PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
}

interface ActivitiesTabProps {
  project: ProjectDetail;
  volunteers: Volunteer[];
  /** Filtro "so atrasadas" fica na URL para poder chegar aqui ja filtrado. */
  onlyLate: boolean;
  onOnlyLateChange: (value: boolean) => void;
  onChanged: () => void;
}

export function ActivitiesTab({ project, volunteers, onlyLate, onOnlyLateChange, onChanged }: ActivitiesTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);

  const [statusFilter, setStatusFilter] = useState<ActivityStatus | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const activities = project.activities;
  const hasFilters = Boolean(statusFilter || assigneeFilter || onlyLate);

  // Responsaveis que aparecem nas atividades do projeto, para o filtro.
  const assignees = useMemo(() => {
    const byId = new Map<string, string>();
    activities.forEach((activity) => {
      if (activity.assignedVolunteerId && activity.assignedVolunteerName)
        byId.set(activity.assignedVolunteerId, activity.assignedVolunteerName);
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const visible = activities.filter((activity) => {
    if (statusFilter && activity.status !== statusFilter) return false;
    if (onlyLate && !activity.isLate) return false;
    if (assigneeFilter === UNASSIGNED) return !activity.assignedVolunteerId;
    if (assigneeFilter && activity.assignedVolunteerId !== assigneeFilter) return false;
    return true;
  });

  function clearFilters() {
    setStatusFilter('');
    setAssigneeFilter('');
    onOnlyLateChange(false);
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openForm(activity: Activity | null, title = '') {
    setEditing(activity);
    setFormTitle(title);
    setFormOpen(true);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return true;
    try {
      await activitiesApi.updateStatus(activity.id, status);
      if (status === 'Concluida') notify(`"${activity.title}" concluída.`);
      onChanged();
      return true;
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a atividade.');
      return false;
    }
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await activitiesApi.remove(removing.id);
      notify('Atividade excluída.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir a atividade.');
    } finally {
      setBusy(false);
    }
  }

  const doneCount = activities.filter((activity) => activity.status === 'Concluida').length;

  return (
    <>
      <QuickAdd project={project} onAdded={onChanged} onOpenForm={(title) => openForm(null, title)} />

      {activities.length > 0 ? (
        <div className="toolbar">
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
            onChange={(event) => setAssigneeFilter(event.target.value)}
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
            <input type="checkbox" checked={onlyLate} onChange={(event) => onOnlyLateChange(event.target.checked)} />
            Só atrasadas
          </label>

          <span className="toolbar__right activities__count num">
            {doneCount} de {activities.length} concluídas
            {hasFilters ? ` · mostrando ${visible.length}` : ''}
          </span>
        </div>
      ) : null}

      {activities.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma atividade registrada"
            description="Use o campo acima para quebrar o projeto em atividades e distribuir responsáveis."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma atividade com esses filtros"
            description="Ajuste os filtros para ver as demais atividades do projeto."
            action={<Button onClick={clearFilters}>Limpar filtros</Button>}
          />
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = visible.filter((activity) => activity.status === group.status).sort(compareActivities);
          if (items.length === 0) return null;

          // Concluidas ficam recolhidas, a menos que o filtro peca exatamente por elas.
          const collapsible = group.status === 'Concluida' && statusFilter !== 'Concluida';
          const open = !collapsible || showDone;

          return (
            <section className="act-group" key={group.status}>
              {collapsible ? (
                <button
                  type="button"
                  className="act-group__title act-group__title--toggle"
                  aria-expanded={open}
                  onClick={() => setShowDone((current) => !current)}
                >
                  {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  {group.title}
                  <span className="tab__count num">{items.length}</span>
                </button>
              ) : (
                <h3 className="act-group__title">
                  {group.title}
                  <span className="tab__count num">{items.length}</span>
                </h3>
              )}

              {open ? (
                <ul className="panel act-list">
                  {items.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      expanded={expanded.has(activity.id)}
                      onToggleExpanded={() => toggleExpanded(activity.id)}
                      onStatusChange={(status) => changeStatus(activity, status)}
                      onEdit={() => openForm(activity)}
                      onRemove={() => setRemoving(activity)}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })
      )}

      {formOpen ? (
        <ActivityFormModal
          projectId={project.id}
          activity={editing}
          initialTitle={formTitle}
          team={project.volunteers}
          volunteers={volunteers}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Atividade atualizada.' : 'Atividade criada.');
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir atividade"
          message={`A atividade "${removing.title}" será removida do projeto.`}
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
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Resolve com false quando a alteracao nao foi salva. */
  onStatusChange: (status: ActivityStatus) => Promise<boolean>;
  onEdit: () => void;
  onRemove: () => void;
}

function ActivityRow({ activity, expanded, onToggleExpanded, onStatusChange, onEdit, onRemove }: ActivityRowProps) {
  // A caixinha responde na hora; se o servidor recusar, volta ao estado salvo.
  const [checkedNow, setCheckedNow] = useState<boolean | null>(null);
  const done = activity.status === 'Concluida';
  const checked = checkedNow ?? done;

  useEffect(() => setCheckedNow(null), [activity.status]);

  async function toggleDone(value: boolean) {
    setCheckedNow(value);
    const saved = await onStatusChange(value ? 'Concluida' : 'AFazer');
    if (!saved) setCheckedNow(null);
  }

  return (
    <li className={`act-row${checked ? ' act-row--done' : ''}`}>
      <input
        type="checkbox"
        className="act-row__check"
        checked={checked}
        aria-label={checked ? `Reabrir "${activity.title}"` : `Concluir "${activity.title}"`}
        title={checked ? 'Reabrir atividade' : 'Marcar como concluída'}
        onChange={(event) => void toggleDone(event.target.checked)}
      />

      <div className="act-row__main">
        <button type="button" className="act-row__title" aria-expanded={expanded} onClick={onToggleExpanded}>
          {activity.title}
        </button>
        <div className="act-row__meta">
          <span>{activity.assignedVolunteerName ?? 'Sem responsável'}</span>
          <span className={activity.isLate ? 'act-row__due--late' : undefined}>
            {done
              ? activity.completedAt
                ? `concluída em ${formatDate(activity.completedAt)}`
                : 'concluída'
              : activity.dueDate
                ? `prazo ${formatDate(activity.dueDate)} · ${dueLabel(activity.dueDate)}`
                : 'sem prazo'}
          </span>
          {!done ? <PriorityBadge priority={activity.priority} /> : null}
        </div>
        {expanded ? <ActivityDetails activity={activity} /> : null}
      </div>

      <div className="act-row__side">
        <ActivityStatusSelect
          status={activity.status}
          label={`Status de ${activity.title}`}
          onChange={(status) => void onStatusChange(status)}
        />
        <Menu
          label="Ações da atividade"
          items={[
            { label: 'Editar', icon: <IconEdit size={14} />, onSelect: onEdit },
            { label: 'Excluir', icon: <IconTrash size={14} />, danger: true, onSelect: onRemove }
          ]}
        />
      </div>
    </li>
  );
}

function ActivityDetails({ activity }: { activity: Activity }) {
  return (
    <div className="activity-detail">
      <div>
        <div className="meta__label">Descrição</div>
        <p className="meta__value activity-detail__text">{activity.description ?? 'Sem descrição.'}</p>
      </div>
      <div>
        <div className="meta__label">Observações</div>
        <p className="meta__value activity-detail__text">{activity.notes ?? 'Sem observações.'}</p>
      </div>
      <div className="activity-detail__dates">
        <span>Criada em {formatDateTime(activity.createdAt)}</span>
        {activity.completedAt ? <span>Concluída em {formatDateTime(activity.completedAt)}</span> : null}
      </div>
    </div>
  );
}

interface QuickAddProps {
  project: ProjectDetail;
  onAdded: () => void;
  /** Abre o formulario completo, levando o titulo ja digitado. */
  onOpenForm: (title: string) => void;
}

/** Adicao rapida: titulo, responsavel (da equipe) e prazo, direto na lista. */
function QuickAdd({ project, onAdded, onOpenForm }: QuickAddProps) {
  const { notify, notifyError } = useToast();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 3) {
      notifyError('Escreva um título com ao menos 3 caracteres.');
      return;
    }

    setSaving(true);
    try {
      await activitiesApi.create(project.id, {
        title: title.trim(),
        description: null,
        assignedVolunteerId: assignee || null,
        status: 'AFazer',
        priority: 'Media',
        dueDate: dueDate || null,
        notes: null
      });
      notify('Atividade adicionada.');
      setTitle('');
      setDueDate('');
      onAdded();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível adicionar a atividade.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel quick-add" onSubmit={handleSubmit}>
      <div className="quick-add__title">
        <IconPlus size={16} />
        <TextInput
          value={title}
          placeholder="Adicionar atividade…"
          aria-label="Título da nova atividade"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <Select value={assignee} aria-label="Responsável da nova atividade" onChange={(event) => setAssignee(event.target.value)}>
        <option value="">Sem responsável</option>
        {project.volunteers.map((member) => (
          <option key={member.volunteerId} value={member.volunteerId}>
            {member.name}
          </option>
        ))}
      </Select>
      <TextInput
        type="date"
        value={dueDate}
        aria-label="Prazo da nova atividade"
        title="Prazo"
        onChange={(event) => setDueDate(event.target.value)}
      />
      <Button type="submit" variant="primary" small loading={saving}>
        Adicionar
      </Button>
      <button type="button" className="quick-add__more" onClick={() => onOpenForm(title.trim())}>
        Formulário completo
      </button>
    </form>
  );
}
