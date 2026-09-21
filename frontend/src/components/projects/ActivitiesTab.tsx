import { useState } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityStatus, ProjectDetail, Volunteer } from '../../types/api';
import { ACTIVITY_STATUSES, activityStatusLabel, dueLabel, formatDate } from '../../utils/format';
import { ActivityStatusBadge, LateBadge, PriorityBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { ActivityFormModal } from './ActivityFormModal';
import { UpdatesSection } from './UpdatesSection';

interface ActivitiesTabProps {
  project: ProjectDetail;
  volunteers: Volunteer[];
  onChanged: () => void;
}

export function ActivitiesTab({ project, volunteers, onChanged }: ActivitiesTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);

  const activities = project.activities;

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

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__right">
          <Button
            variant="primary"
            small
            icon={<IconPlus size={15} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
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
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Criar primeira atividade
              </Button>
            }
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
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td style={{ minWidth: 240 }}>
                      <div className="table__primary">{activity.title}</div>
                      {activity.description ? <div className="table__secondary">{activity.description}</div> : null}
                    </td>
                    <td>{activity.assignedVolunteerName ?? '—'}</td>
                    <td>
                      <PriorityBadge priority={activity.priority} />
                    </td>
                    <td className="tight">
                      {formatDate(activity.dueDate)}
                      <div className="table__secondary">{activity.isLate ? <LateBadge /> : dueLabel(activity.dueDate)}</div>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen ? (
        <ActivityFormModal
          projectId={project.id}
          activity={editing}
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
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <ActivityStatusBadge status="Concluida" />
          {activities.filter((activity) => activity.status === 'Concluida').length} de {activities.length} atividades
          concluídas
        </div>
      ) : null}

      <UpdatesSection project={project} onChanged={onChanged} />
    </>
  );
}
