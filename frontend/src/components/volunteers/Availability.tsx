import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { volunteersApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { AvailabilitySlot, Shift, TransportMode, VolunteerAvailability, WeekDay } from '../../types/api';
import {
  SHIFTS,
  TRANSPORT_MODES,
  WEEK_DAYS,
  formatDate,
  shiftLabel,
  shiftPhrase,
  transportLabel,
  weekDayLabel,
  weekDayShortLabel
} from '../../utils/format';
import { locateDistrict } from '../../utils/geocode';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconEdit } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** Turnos livres que pedem revisao: o horario de aula muda a cada semestre. */
const STALE_DAYS = 180;

const slotKey = (day: WeekDay, shift: Shift) => `${day}-${shift}`;

function isStale(updatedAt: string | null) {
  return Boolean(updatedAt) && Date.now() - new Date(updatedAt!).getTime() > STALE_DAYS * 86400000;
}

/**
 * Grade da semana (dias x manha, tarde e noite). Com onToggle, cada casa e uma caixinha de marcar; sem, so mostra
 * os turnos livres.
 */
export function AvailabilityGrid({
  slots,
  onToggle
}: {
  slots: AvailabilitySlot[];
  onToggle?: (day: WeekDay, shift: Shift) => void;
}) {
  const free = new Set(slots.map((slot) => slotKey(slot.day, slot.shift)));

  return (
    <table className={`avail-grid${onToggle ? ' avail-grid--edit' : ''}`}>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Turno</span>
          </th>
          {WEEK_DAYS.map((day) => (
            <th key={day} scope="col" abbr={weekDayLabel(day)}>
              {weekDayShortLabel(day)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SHIFTS.map((shift) => (
          <tr key={shift}>
            <th scope="row">{shiftLabel(shift)}</th>
            {WEEK_DAYS.map((day) => {
              const on = free.has(slotKey(day, shift));
              const label = `${weekDayLabel(day)} ${shiftPhrase(shift)}`;
              return (
                <td key={day}>
                  {onToggle ? (
                    <label className={`avail-cell${on ? ' avail-cell--on' : ''}`} title={label}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        aria-label={label}
                        onChange={() => onToggle(day, shift)}
                      />
                    </label>
                  ) : (
                    <span
                      className={`avail-cell${on ? ' avail-cell--on' : ''}`}
                      role="img"
                      aria-label={`${label}: ${on ? 'livre' : 'não marcado'}`}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface AvailabilityModalProps {
  volunteerId: string;
  availability: VolunteerAvailability | null;
  /** A propria pessoa (Minha conta, Inicio): o texto fala com ela. */
  isSelf: boolean;
  onClose: () => void;
  onSaved: (saved: VolunteerAvailability) => void;
}

/** Bairro, cidade, deslocamento e a grade de turnos livres. O bairro e procurado no mapa ao salvar. */
export function AvailabilityModal({ volunteerId, availability, isSelf, onClose, onSaved }: AvailabilityModalProps) {
  const { notify } = useToast();
  const [district, setDistrict] = useState(availability?.district ?? '');
  const [city, setCity] = useState(availability?.city ?? '');
  const [transport, setTransport] = useState<TransportMode | ''>(availability?.transport ?? '');
  const [slots, setSlots] = useState<AvailabilitySlot[]>(availability?.slots ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(day: WeekDay, shift: Shift) {
    setSlots((current) =>
      current.some((slot) => slot.day === day && slot.shift === shift)
        ? current.filter((slot) => !(slot.day === day && slot.shift === shift))
        : [...current, { day, shift }]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const place = { district: district.trim() || null, city: city.trim() || null };
      // O bairro so e procurado no mapa quando mudou (ou ainda nao foi achado); sem ponto novo, a API mantem o de antes.
      const samePlace =
        availability?.located && place.district === (availability.district ?? null) && place.city === (availability.city ?? null);
      const point = samePlace ? null : await locateDistrict(place.district, place.city);
      const result = await volunteersApi.saveAvailability(volunteerId, {
        ...place,
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        transport: transport || null,
        slots
      });
      notify(
        (place.district || place.city) && !result.located
          ? 'Salvo. Não achamos esse bairro no mapa: confira o nome para a distância até as obras aparecer.'
          : 'Disponibilidade salva.'
      );
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={isSelf ? 'Onde você mora e quando está livre' : 'Bairro, deslocamento e turnos'}
      subtitle="Serve para sugerir quem pode ir a cada visita. Só a coordenação e a própria pessoa veem."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error ? (
          <div className="mb-16">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}

        <div className="form-grid">
          <Field label="Bairro" htmlFor="availability-district" hint="Só o bairro, nunca o endereço.">
            <TextInput
              id="availability-district"
              maxLength={120}
              value={district}
              placeholder="Ex.: Restinga"
              onChange={(event) => setDistrict(event.target.value)}
            />
          </Field>
          <Field label="Cidade" htmlFor="availability-city">
            <TextInput
              id="availability-city"
              maxLength={120}
              value={city}
              placeholder="Ex.: Porto Alegre"
              onChange={(event) => setCity(event.target.value)}
            />
          </Field>
          <Field label="Como se desloca" htmlFor="availability-transport" span>
            <Select
              id="availability-transport"
              value={transport}
              onChange={(event) => setTransport(event.target.value as TransportMode | '')}
            >
              <option value="">Não informado</option>
              {TRANSPORT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {transportLabel(mode)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="avail-fieldset">
          <legend>{isSelf ? 'Turnos em que você costuma estar livre' : 'Turnos em que costuma estar livre'}</legend>
          <p className="field__hint">Toque para marcar ou desmarcar. Vale para toda semana; atualize quando o horário mudar.</p>
          <AvailabilityGrid slots={slots} onToggle={toggle} />
        </fieldset>

        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}

interface AvailabilityPanelProps {
  volunteerId: string;
  /** null: ainda carregando (Minha conta busca a parte). */
  availability: VolunteerAvailability | null;
  isSelf: boolean;
  canEdit: boolean;
  onSaved: (saved: VolunteerAvailability) => void;
}

/** Painel "Disponibilidade para visitas": bairro, deslocamento e a grade, com o botao de editar. */
export function AvailabilityPanel({ volunteerId, availability, isSelf, canEdit, onSaved }: AvailabilityPanelProps) {
  const [editing, setEditing] = useState(false);
  const filled = Boolean(availability?.updatedAt);
  const place = [availability?.district, availability?.city].filter(Boolean).join(', ');

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Disponibilidade para visitas</h2>
        {canEdit && filled ? (
          <div className="panel__actions">
            <Button small icon={<IconEdit size={14} />} onClick={() => setEditing(true)}>
              Editar
            </Button>
          </div>
        ) : null}
      </div>
      <div className="panel__body">
        {!availability ? null : !filled ? (
          <div className="avail-empty">
            <p className="meta__value">
              {isSelf
                ? 'Conte em que bairro mora, como se desloca e quando costuma estar livre: assim a coordenação acha quem pode ir a cada visita.'
                : 'Ainda não preenchido. A própria pessoa preenche em Minha conta, ou a coordenação aqui.'}
            </p>
            {canEdit ? (
              <Button variant="primary" small onClick={() => setEditing(true)}>
                Preencher
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="meta-list avail-meta">
              <div>
                <div className="meta__label">Mora em</div>
                <div className="meta__value">{place || 'Não informado'}</div>
                {place && !availability.located ? (
                  <div className="field__hint">Bairro não achado no mapa: confira o nome para a distância aparecer.</div>
                ) : null}
              </div>
              <div>
                <div className="meta__label">Deslocamento</div>
                <div className="meta__value">{availability.transport ? transportLabel(availability.transport) : 'Não informado'}</div>
              </div>
            </div>
            <div className="meta__label mt-12">Turnos livres</div>
            {availability.slots.length > 0 ? (
              <AvailabilityGrid slots={availability.slots} />
            ) : (
              <p className="meta__value">Nenhum turno marcado.</p>
            )}
            <p className={`field__hint mt-12${isStale(availability.updatedAt) ? ' avail-stale' : ''}`}>
              Atualizado em {formatDate(availability.updatedAt)}
              {isStale(availability.updatedAt) ? ' · faz tempo: o horário ainda vale?' : ''}
            </p>
          </>
        )}
      </div>

      {editing && availability ? (
        <AvailabilityModal
          volunteerId={volunteerId}
          availability={availability}
          isSelf={isSelf}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onSaved(saved);
          }}
        />
      ) : null}
    </section>
  );
}

/** Minha conta: o painel com a disponibilidade da propria pessoa, buscada a parte. */
export function MyAvailabilityPanel({ volunteerId }: { volunteerId: string | null }) {
  const [availability, setAvailability] = useState<VolunteerAvailability | null>(null);

  useEffect(() => {
    if (!volunteerId) return;
    volunteersApi
      .availability(volunteerId)
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, [volunteerId]);

  if (!volunteerId || !availability) return null;
  return <AvailabilityPanel volunteerId={volunteerId} availability={availability} isSelf canEdit onSaved={setAvailability} />;
}

/**
 * Aviso no Inicio: quem nunca preencheu bairro e turnos (ou preencheu ha mais de seis meses, quando o horario de aula
 * costuma mudar) e convidado a preencher.
 */
export function AvailabilityCallout({ volunteerId }: { volunteerId: string | null }) {
  const [availability, setAvailability] = useState<VolunteerAvailability | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!volunteerId) return;
    volunteersApi
      .availability(volunteerId)
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, [volunteerId]);

  if (!volunteerId || !availability) return null;
  const never = !availability.updatedAt;
  if (!never && !isStale(availability.updatedAt) && !open) return null;

  return (
    <>
      {never || isStale(availability.updatedAt) ? (
        <section className="term-callout" aria-label="Disponibilidade para visitas">
          <div>
            <strong>{never ? 'Quando você costuma estar livre?' : 'Seus turnos livres ainda valem?'}</strong>
            <p>
              {never
                ? 'Marque o bairro onde mora, como se desloca e os turnos livres da semana. A coordenação usa isso para combinar as visitas às obras.'
                : `Você atualizou em ${formatDate(availability.updatedAt)}. Se o horário mudou, confira a grade.`}
            </p>
          </div>
          <Button variant="primary" onClick={() => setOpen(true)}>
            {never ? 'Preencher' : 'Conferir'}
          </Button>
        </section>
      ) : null}
      {open ? (
        <AvailabilityModal
          volunteerId={volunteerId}
          availability={availability}
          isSelf
          onClose={() => setOpen(false)}
          onSaved={(saved) => {
            setOpen(false);
            setAvailability(saved);
          }}
        />
      ) : null}
    </>
  );
}
