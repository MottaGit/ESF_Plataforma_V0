import { Fragment, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityStatus, ProjectDetail, Volunteer } from '../../types/api';
import { ACTIVITY_STATUSES, activityStatusLabel, dueLabel, formatDate, formatDateTime } from '../../utils/format';
import { ActivityStatusBadge, LateBadge, PriorityBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { ActivityFormModal } from './ActivityFormModal';

/** Valor do filtro de responsavel para atividades sem ninguem atribuido. */
const UNASSIGNED = '__none__';

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
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return;
    try {
      await activitiesApi.updateStatus(activity.id, status);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a atividade.');
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
          </>
        ) : null}

        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={openNew}>
            Nova atividade
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma atividade registrada"
            description="Quebre o projeto em atividades para acompanhar a execução e distribuir responsáveis."
            action={
              <Button variant="primary" onClick={openNew}>
                Criar primeira atividade
              </Button>
            }
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
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Atividade</th>
                  <th>Responsável</th>
                  <th>Prioridade</th>
                  <th className="tight">Prazo</th>
                  <th style={{ width: 170 }}>Status</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((activity) => {
                  const open = expanded.has(activity.id);
                  return (
                    <Fragment key={activity.id}>
                      <tr className={open ? 'table__row--open' : undefined}>
                        <td style={{ minWidth: 240 }}>
                          <button
                            type="button"
                            className="row-toggle"
                            aria-expanded={open}
                            onClick={() => toggle(activity.id)}
                          >
                            {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                            <span className="table__primary">{activity.title}</span>
                          </button>
                          {!open && activity.description ? (
                            <div className="table__secondary table__secondary--clamp">{activity.description}</div>
                          ) : null}
                        </td>
                        <td>{activity.assignedVolunteerName ?? '—'}</td>
                        <td>
                          <PriorityBadge priority={activity.priority} />
                        </td>
                        <td className="tight">
                          {formatDate(activity.dueDate)}
                          <div className="table__secondary">
                            {activity.status === 'Concluida' ? (
                              activity.completedAt ? `concluída em ${formatDate(activity.completedAt)}` : 'concluída'
                            ) : activity.isLate ? (
                              <LateBadge label="Atrasada" />
                            ) : (
                              dueLabel(activity.dueDate)
                            )}
                          </div>
                        </td>
                        <td>
                          <Select
                            value={activity.status}
                            aria-label={`Status de ${activity.title}`}
                            onChange={(event) => void changeStatus(activity, event.target.value as ActivityStatus)}
                          >
                            {ACTIVITY_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {activityStatusLabel(status)}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <div className="row-actions">
                            <Button
                              small
                              variant="ghost"
                              icon={<IconEdit size={15} />}
                              title="Editar atividade"
                              aria-label="Editar atividade"
                              onClick={() => {
                                setEditing(activity);
                                setFormOpen(true);
                              }}
                            />
                            <Button
                              small
                              variant="ghost"
                              icon={<IconTrash size={15} />}
                              title="Excluir atividade"
                              aria-label="Excluir atividade"
                              onClick={() => setRemoving(activity)}
                            />
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="table__detail">
                          <td colSpan={6}>
                            <ActivityDetails activity={activity} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen ? (
        <ActivityFormModal
          projectId={project.id}
          activity={editing}
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

      {activities.length > 0 ? (
        <div className="activities__footer">
          <ActivityStatusBadge status="Concluida" />
          {doneCount} de {activities.length} atividades concluídas
          {hasFilters ? ` · mostrando ${visible.length}` : ''}
        </div>
      ) : null}
    </>
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
