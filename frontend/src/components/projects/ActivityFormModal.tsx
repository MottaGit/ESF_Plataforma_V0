import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import type { Activity, ActivityPriority, ActivityStatus, SaveActivityPayload, User } from '../../types/api';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  activityStatusLabel,
  emptyToNull,
  priorityLabel
} from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

interface ActivityFormModalProps {
  projectId: string;
  activity: Activity | null;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}

export function ActivityFormModal({ projectId, activity, users, onClose, onSaved }: ActivityFormModalProps) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [assignedUserId, setAssignedUserId] = useState(activity?.assignedUserId ?? '');
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'AFazer');
  const [priority, setPriority] = useState<ActivityPriority>(activity?.priority ?? 'Media');
  const [dueDate, setDueDate] = useState(activity?.dueDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(activity?.notes ?? '');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (title.trim().length < 3) {
      setTitleError('Informe um título com ao menos 3 caracteres.');
      return;
    }
    setTitleError(null);

    const payload: SaveActivityPayload = {
      title: title.trim(),
      description: emptyToNull(description),
      assignedUserId: assignedUserId || null,
      status,
      priority,
      dueDate: dueDate || null,
      notes: emptyToNull(notes)
    };

    setSaving(true);
    try {
      if (activity) await activitiesApi.update(activity.id, payload);
      else await activitiesApi.create(projectId, payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar a atividade.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={activity ? 'Editar atividade' : 'Nova atividade'}
      subtitle="Atividades organizam a execução do projeto no dia a dia."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            {activity ? 'Salvar alterações' : 'Criar atividade'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {formError ? (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{formError}</Alert>
          </div>
        ) : null}

        <div className="form-grid">
          <Field label="Título" htmlFor="activity-title" required error={titleError ?? undefined} span>
            <TextInput
              id="activity-title"
              value={title}
              invalid={Boolean(titleError)}
              placeholder="Ex.: Refazer instalação elétrica da casa 2"
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field label="Descrição" htmlFor="activity-description" span>
            <TextArea
              id="activity-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <Field label="Responsável" htmlFor="activity-owner">
            <Select
              id="activity-owner"
              value={assignedUserId}
              onChange={(event) => setAssignedUserId(event.target.value)}
            >
              <option value="">Sem responsável</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prazo" htmlFor="activity-due">
            <TextInput
              id="activity-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Status" htmlFor="activity-status" required>
            <Select
              id="activity-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ActivityStatus)}
            >
              {ACTIVITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {activityStatusLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioridade" htmlFor="activity-priority" required>
            <Select
              id="activity-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ActivityPriority)}
            >
              {ACTIVITY_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {priorityLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Observações" htmlFor="activity-notes" span>
            <TextArea id="activity-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
