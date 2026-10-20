import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { volunteersApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { VolunteerHours, VolunteerStatus, VolunteerStatusPeriod } from '../../types/api';
import { VOLUNTEER_STATUSES, formatDate, formatNumber, todayInputValue, volunteerStatusLabel } from '../../utils/format';
import { VolunteerStatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** "desde 01/09/2025 (atual)" ou "01/08/2025 a 31/08/2025". */
export function statusPeriodLabel(period: VolunteerStatusPeriod) {
  return period.endsOn
    ? `${formatDate(period.startsOn)} a ${formatDate(period.endsOn)}`
    : `desde ${formatDate(period.startsOn)} (atual)`;
}

interface VolunteerHoursPanelProps {
  volunteerId: string;
  hours: VolunteerHours;
  canEdit: boolean;
  onChanged: () => void;
}

/**
 * Horas de voluntariado (dias como Ativo x carga semanal) e o historico de status que as sustenta. O historico so
 * aparece para a coordenacao e para o proprio voluntario; so a coordenacao edita.
 */
export function VolunteerHoursPanel({ volunteerId, hours, canEdit, onChanged }: VolunteerHoursPanelProps) {
  const { notify, notifyError } = useToast();
  const [editing, setEditing] = useState<VolunteerStatusPeriod | 'new' | null>(null);
  const [removing, setRemoving] = useState<VolunteerStatusPeriod | null>(null);
  const [busy, setBusy] = useState(false);
  const history = hours.history;

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await volunteersApi.removeStatusPeriod(volunteerId, removing.id);
      notify('Período removido do histórico.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível remover o período.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Horas de voluntariado</h2>
        {canEdit ? (
          <div className="panel__actions">
            <Button small icon={<IconPlus size={15} />} onClick={() => setEditing('new')}>
              Incluir período
            </Button>
          </div>
        ) : null}
      </div>
      <div className="panel__body">
        <div className="hours">
          <span className="hours__value">{formatNumber(hours.hours)} h</span>
          <span className="hours__hint">{hours.weeklyHours} h por semana nos períodos como Ativo</span>
        </div>

        {history ? (
          <>
            <div className="meta__label hours__title">Histórico de status</div>
            {history.length === 0 ? (
              <p className="hours__hint">Nenhum período registrado.</p>
            ) : (
              <ul className="status-history">
                {history.map((period) => (
                  <li key={period.id} className="status-history__item">
                    <span className="status-history__status">
                      <VolunteerStatusBadge status={period.status} />
                    </span>
                    <span className="status-history__dates">{statusPeriodLabel(period)}</span>
                    {canEdit ? (
                      <div className="row-actions">
                        <Button
                          small
                          variant="ghost"
                          icon={<IconEdit size={15} />}
                          title="Editar período"
                          aria-label={`Editar período ${statusPeriodLabel(period)}`}
                          onClick={() => setEditing(period)}
                        />
                        {history.length > 1 ? (
                          <Button
                            small
                            variant="ghost"
                            icon={<IconTrash size={15} />}
                            title="Remover período"
                            aria-label={`Remover período ${statusPeriodLabel(period)}`}
                            onClick={() => setRemoving(period)}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>

      {editing ? (
        <StatusPeriodModal
          volunteerId={volunteerId}
          period={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Histórico de status atualizado.');
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Remover período"
          message={`O período "${volunteerStatusLabel(removing.status)}, ${statusPeriodLabel(removing)}" sai do histórico e, nessas datas, passa a valer o status anterior a ele.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
        />
      ) : null}
    </section>
  );
}

interface StatusPeriodModalProps {
  volunteerId: string;
  /** null: incluir um periodo novo. */
  period: VolunteerStatusPeriod | null;
  onClose: () => void;
  onSaved: () => void;
}

function StatusPeriodModal({ volunteerId, period, onClose, onSaved }: StatusPeriodModalProps) {
  // O periodo atual nao tem data final: para encerra-lo, inclui-se o status seguinte.
  const isCurrent = period !== null && period.endsOn === null;
  const today = todayInputValue();
  const [status, setStatus] = useState<VolunteerStatus>(period?.status ?? 'Ativo');
  const [startsOn, setStartsOn] = useState(period?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(period?.endsOn ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!startsOn) {
      setError('Informe a data de início.');
      return;
    }
    if (endsOn && endsOn < startsOn) {
      setError('A data final deve ser depois da data de início.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { status, startsOn, endsOn: isCurrent || !endsOn ? null : endsOn };
    try {
      if (period) await volunteersApi.updateStatusPeriod(volunteerId, period.id, payload);
      else await volunteersApi.addStatusPeriod(volunteerId, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o período.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={period ? 'Editar período' : 'Incluir período'}
      subtitle={
        isCurrent
          ? 'Este é o status atual. Para encerrá-lo, inclua um período com o novo status.'
          : 'O período substitui o que estiver registrado nessas datas. Depois dele, volta o status anterior.'
      }
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={save} className="form-grid form-grid--single">
        <Field label="Status" htmlFor="period-status" required>
          <Select id="period-status" value={status} onChange={(event) => setStatus(event.target.value as VolunteerStatus)}>
            {VOLUNTEER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {volunteerStatusLabel(item)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De" htmlFor="period-start" required>
          <TextInput
            id="period-start"
            type="date"
            max={today}
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </Field>
        {isCurrent ? null : (
          <Field label="Até" htmlFor="period-end" hint="Deixe em branco se continua até hoje.">
            <TextInput
              id="period-end"
              type="date"
              max={today}
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </Field>
        )}
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
