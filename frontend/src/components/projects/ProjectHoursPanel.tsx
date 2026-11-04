import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { projectHoursApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectHourEntry, ProjectHours } from '../../types/api';
import { formatDate, formatHours, todayInputValue } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** Quantos lancamentos aparecem antes de "Ver todos". */
const VISIBLE_ENTRIES = 8;

interface ProjectHoursPanelProps {
  project: ProjectDetail;
  hours: ProjectHours | null;
  onChanged: () => void;
}

/**
 * Horas de voluntariado lancadas no projeto (aba Equipe): o total e os lancamentos, mais novos primeiro. Quem esta na
 * equipe lanca as proprias; a coordenacao lanca e corrige as de qualquer um.
 */
export function ProjectHoursPanel({ project, hours, onChanged }: ProjectHoursPanelProps) {
  const { user, canManage } = useAuth();
  const { notify, notifyError } = useToast();
  const [editing, setEditing] = useState<ProjectHourEntry | 'new' | null>(null);
  const [removing, setRemoving] = useState<ProjectHourEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const inTeam = project.volunteers.some((member) => member.volunteerId === user?.volunteerId);
  const canLog = canManage || inTeam;
  const entries = hours?.entries ?? [];
  const shown = showAll ? entries : entries.slice(0, VISIBLE_ENTRIES);

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await projectHoursApi.remove(removing.id);
      notify('Lançamento de horas apagado.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível apagar o lançamento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel project-hours">
      <div className="panel__head">
        <h2>Horas no projeto</h2>
        {hours && hours.total > 0 ? <span className="tab__count num">{formatHours(hours.total)}</span> : null}
        {canLog && project.volunteers.length > 0 ? (
          <div className="panel__actions">
            <Button small icon={<IconPlus size={15} />} onClick={() => setEditing('new')}>
              Lançar horas
            </Button>
          </div>
        ) : null}
      </div>

      {hours === null ? null : entries.length === 0 ? (
        <EmptyState
          title="Nenhuma hora lançada"
          description="Quem está na equipe lança as próprias horas aqui ou junto com o registro de andamento. Elas entram no relatório e no certificado do projeto."
        />
      ) : (
        <>
          <ul className="hours-list">
            {shown.map((entry) => (
              <li key={entry.id} className="hours-list__item">
                <Avatar name={entry.volunteerName} photoUrl={entry.photoUrl} size={28} />
                <div className="hours-list__main">
                  <div>
                    <strong>{entry.volunteerName}</strong>
                    <span className="table__secondary"> · {formatDate(entry.date)}</span>
                  </div>
                  {entry.description ? <div className="hours-list__what">{entry.description}</div> : null}
                </div>
                <span className="hours-list__hours num">{formatHours(entry.hours)}</span>
                {entry.canEdit ? (
                  <div className="row-actions">
                    <Button
                      small
                      variant="ghost"
                      icon={<IconEdit size={15} />}
                      title="Corrigir"
                      aria-label="Corrigir lançamento"
                      onClick={() => setEditing(entry)}
                    />
                    <Button
                      small
                      variant="ghost"
                      icon={<IconTrash size={15} />}
                      title="Apagar"
                      aria-label="Apagar lançamento"
                      onClick={() => setRemoving(entry)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {entries.length > VISIBLE_ENTRIES ? (
            <div className="hours-list__more">
              <Button small variant="ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Mostrar menos' : `Ver todos os lançamentos (${entries.length})`}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {editing ? (
        <HourEntryModal
          project={project}
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify(editing === 'new' ? 'Horas lançadas.' : 'Lançamento corrigido.');
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Apagar lançamento"
          message={`${formatHours(removing.hours)} de ${removing.volunteerName} em ${formatDate(removing.date)} deixam de contar no projeto.`}
          confirmLabel="Apagar"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
        />
      ) : null}
    </section>
  );
}

/** "2,5" ou "2.5" -> 2.5 (vazio ou invalido: NaN). */
function parseHours(value: string) {
  return value.trim() === '' ? Number.NaN : Number(value.replace(',', '.'));
}

interface HourEntryModalProps {
  project: ProjectDetail;
  /** null: novo lancamento. */
  entry: ProjectHourEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

function HourEntryModal({ project, entry, onClose, onSaved }: HourEntryModalProps) {
  const { user, canManage } = useAuth();
  const inTeam = project.volunteers.some((member) => member.volunteerId === user?.volunteerId);
  const [volunteerId, setVolunteerId] = useState(
    entry?.volunteerId ?? (inTeam ? user!.volunteerId! : project.volunteers[0]?.volunteerId ?? '')
  );
  const [date, setDate] = useState(entry?.date ?? todayInputValue());
  const [hours, setHours] = useState(entry ? String(entry.hours).replace('.', ',') : '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    const value = parseHours(hours);
    if (!(value > 0 && value <= 24)) {
      setError('Informe de 0,25 a 24 horas.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { volunteerId: canManage ? volunteerId : null, date, hours: value, description: description.trim() || null };
    try {
      if (entry) await projectHoursApi.update(entry.id, payload);
      else await projectHoursApi.create(project.id, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar as horas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={entry ? 'Corrigir horas' : 'Lançar horas'}
      subtitle={project.name}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {entry ? 'Salvar' : 'Lançar'}
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form className="form-grid" onSubmit={save}>
        {canManage ? (
          <Field label="Pessoa" htmlFor="hours-volunteer" required span>
            <Select id="hours-volunteer" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
              {project.volunteers.map((member) => (
                <option key={member.volunteerId} value={member.volunteerId}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Dia" htmlFor="hours-date" required>
          <TextInput id="hours-date" type="date" value={date} max={todayInputValue()} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Horas" htmlFor="hours-value" required hint="Ex.: 3 ou 1,5">
          <TextInput
            id="hours-value"
            inputMode="decimal"
            autoFocus
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        </Field>
        <Field label="O que fez" htmlFor="hours-what" hint="Opcional. Aparece no certificado do projeto." span>
          <TextInput
            id="hours-what"
            maxLength={300}
            placeholder="Ex.: visita técnica, projeto hidrossanitário, acompanhamento da obra"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
