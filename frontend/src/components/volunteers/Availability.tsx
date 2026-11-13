import { Suspense, lazy, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '../../api/client';
import { organizationApi, volunteersApi } from '../../api/endpoints';
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
import { searchAddress, searchPlaces, type PlaceOption } from '../../utils/geocode';
import type { MapPoint } from '../map/PlaceMap';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconEdit } from '../ui/Icons';
import { Modal } from '../ui/Modal';

// O mapa (Leaflet) so carrega quando a janela mostra um.
const PlaceMap = lazy(() => import('../map/PlaceMap').then((module) => ({ default: module.PlaceMap })));

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

/** Onde a pessoa mora, como fica no formulario: bairro e cidade e o ponto aproximado (null: sem ponto no mapa). */
interface ChosenPlace {
  district: string | null;
  city: string | null;
  point: MapPoint | null;
}

/** Toque no mapa: duas casas decimais (uns 1 km), para nunca marcar a casa da pessoa. */
const roundToKm = (value: number) => Math.round(value * 100) / 100;

/** "Porto Alegre, RS" / "cidade, RS" embaixo de cada resultado da busca. */
function placeDetail(option: PlaceOption) {
  return option.district ? [option.city, option.uf].filter(Boolean).join(', ') : ['cidade', option.uf].filter(Boolean).join(', ');
}

interface PlaceFieldProps {
  value: ChosenPlace | null;
  nucleoCity: string | null;
  onChange: (place: ChosenPlace) => void;
  /** A busca ou a marcacao no mapa esta aberta sem nada escolhido: o formulario nao salva assim. */
  onPendingChange: (pending: boolean) => void;
}

/**
 * "Onde mora": um campo de busca que procura o bairro no mapa e mostra a lista para escolher (bairro e cidade vem do
 * mapa, nao sao digitados); escolhido, o bairro aparece num mapa pequeno. Nao achou: tocar no mapa perto de onde mora
 * e escrever o nome do bairro.
 */
function PlaceField({ value, nucleoCity, onChange, onPendingChange }: PlaceFieldProps) {
  const [mode, setMode] = useState<'show' | 'search' | 'pick'>(value ? 'show' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceOption[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickPoint, setPickPoint] = useState<MapPoint | null>(null);
  const [pickDistrict, setPickDistrict] = useState('');
  const [pickCity, setPickCity] = useState(nucleoCity ?? '');
  const [cityCenter, setCityCenter] = useState<MapPoint | null>(null);

  useEffect(() => {
    onPendingChange(mode === 'pick' || (mode === 'search' && query.trim().length > 0));
  }, [mode, query, onPendingChange]);

  async function search() {
    if (query.trim().length < 2) {
      setMessage('Escreva o nome do bairro.');
      return;
    }
    setSearching(true);
    setMessage(null);
    setResults(null);
    try {
      const found = await searchPlaces(query, nucleoCity);
      setResults(found);
      if (found.length === 0)
        setMessage(
          query.includes(',') || !nucleoCity
            ? 'Nenhum bairro com esse nome no mapa. Confira o nome ou marque no mapa.'
            : `Nenhum bairro com esse nome em ${nucleoCity}. Mora em outra cidade? Escreva "bairro, cidade" (ex.: Centro, Canoas). Ou marque no mapa.`
        );
    } catch {
      setMessage('A busca do mapa não respondeu. Tente de novo ou marque no mapa.');
    } finally {
      setSearching(false);
    }
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter busca, em vez de salvar a janela inteira.
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void search();
  }

  function choose(option: PlaceOption) {
    onChange({ district: option.district, city: option.city, point: { lat: option.lat, lng: option.lng } });
    setResults(null);
    setQuery('');
    setMessage(null);
    setMode('show');
  }

  async function startPick() {
    setMode('pick');
    setPickPoint(null);
    setPickDistrict(query.split(',')[0].trim());
    setPickCity((current) => current || nucleoCity || '');
    // O mapa abre no bairro de antes ou na cidade do nucleo (uma busca so, a da cidade).
    if (value?.point) setCityCenter(value.point);
    else if (nucleoCity && !cityCenter) {
      try {
        const [city] = await searchAddress(nucleoCity);
        if (city) setCityCenter({ lat: city.lat, lng: city.lng });
      } catch {
        // Sem a cidade, o mapa fica no centro padrao.
      }
    }
  }

  function usePicked() {
    if (!pickPoint || !pickDistrict.trim()) return;
    onChange({ district: pickDistrict.trim(), city: pickCity.trim() || null, point: pickPoint });
    setMode('show');
    setQuery('');
  }

  if (mode === 'show' && value) {
    return (
      <div className="place-field">
        <div className="place-field__chosen">
          <span>
            <strong>{value.district ?? value.city}</strong>
            {value.district && value.city ? ` · ${value.city}` : ''}
          </span>
          {value.point ? (
            <span className="place-field__ok">no mapa ✓</span>
          ) : (
            <span className="place-field__warn">sem ponto no mapa</span>
          )}
          <Button
            small
            onClick={() => {
              setQuery(value.district ?? value.city ?? '');
              setMode('search');
            }}
          >
            Trocar
          </Button>
        </div>
        {value.point ? (
          <Suspense fallback={<div className="place-map" />}>
            <PlaceMap point={value.point} />
          </Suspense>
        ) : (
          <p className="field__hint">Toque em Trocar e escolha o bairro na busca, para a distância até as obras aparecer.</p>
        )}
      </div>
    );
  }

  if (mode === 'pick') {
    return (
      <div className="place-field">
        <p className="field__hint">
          Toque no mapa perto de onde mora. O ponto é arredondado (uns 1 km): a casa nunca fica marcada.
        </p>
        <Suspense fallback={<div className="place-map place-map--pick" />}>
          <PlaceMap
            point={pickPoint}
            center={cityCenter}
            onPick={(point) => setPickPoint({ lat: roundToKm(point.lat), lng: roundToKm(point.lng) })}
          />
        </Suspense>
        <div className="form-grid">
          <Field label="Nome do bairro" htmlFor="availability-pick-district" required>
            <TextInput
              id="availability-pick-district"
              maxLength={120}
              value={pickDistrict}
              onChange={(event) => setPickDistrict(event.target.value)}
            />
          </Field>
          <Field label="Cidade" htmlFor="availability-pick-city">
            <TextInput
              id="availability-pick-city"
              maxLength={120}
              value={pickCity}
              onChange={(event) => setPickCity(event.target.value)}
            />
          </Field>
        </div>
        <div className="row">
          <Button small variant="primary" disabled={!pickPoint || !pickDistrict.trim()} onClick={usePicked}>
            Usar este lugar
          </Button>
          <Button small onClick={() => setMode('search')}>
            Voltar à busca
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="place-field">
      <div className="place-search">
        <TextInput
          id="availability-place"
          value={query}
          maxLength={120}
          placeholder="Bairro, ex.: Restinga"
          onKeyDown={onSearchKey}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button loading={searching} onClick={() => void search()}>
          Buscar
        </Button>
      </div>
      <p className="field__hint">
        {nucleoCity ? `Procura em ${nucleoCity}; de outra cidade, escreva "bairro, cidade". ` : 'Escreva "bairro, cidade". '}
        Só o bairro, nunca o endereço.
      </p>

      {results && results.length > 0 ? (
        <ul className="place-results" aria-label="Bairros achados">
          {results.map((option) => (
            <li key={`${option.district}-${option.city}-${option.lat}`}>
              <button type="button" onClick={() => choose(option)}>
                <strong>{option.district ?? option.city}</strong>
                <span>{placeDetail(option)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="field__hint">{message}</p> : null}

      <div className="row">
        <button type="button" className="link-button" onClick={() => void startPick()}>
          Não achou? Marcar no mapa
        </button>
        {value ? (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setQuery('');
              setResults(null);
              setMessage(null);
              setMode('show');
            }}
          >
            Cancelar a troca
          </button>
        ) : null}
      </div>
    </div>
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

/** Onde mora (busca no mapa), deslocamento e a grade de turnos livres. */
export function AvailabilityModal({ volunteerId, availability, isSelf, onClose, onSaved }: AvailabilityModalProps) {
  const { notify } = useToast();
  const [place, setPlace] = useState<ChosenPlace | null>(
    availability && (availability.district || availability.city)
      ? {
          district: availability.district,
          city: availability.city,
          point:
            availability.latitude !== null && availability.longitude !== null
              ? { lat: availability.latitude, lng: availability.longitude }
              : null
        }
      : null
  );
  // Ponto novo so vai para a API quando o lugar foi escolhido agora; sem isso, ela mantem o de antes.
  const [placeChanged, setPlaceChanged] = useState(false);
  const [placePending, setPlacePending] = useState(false);
  const [nucleoCity, setNucleoCity] = useState<string | null>(null);
  const [transport, setTransport] = useState<TransportMode | ''>(availability?.transport ?? '');
  const [slots, setSlots] = useState<AvailabilitySlot[]>(availability?.slots ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    organizationApi
      .get()
      .then((organization) => setNucleoCity(organization.city))
      .catch(() => setNucleoCity(null));
  }, []);

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
    if (placePending) {
      setError('Escolha o bairro na lista da busca (ou cancele a troca) antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const result = await volunteersApi.saveAvailability(volunteerId, {
        district: place?.district ?? null,
        city: place?.city ?? null,
        latitude: placeChanged ? place?.point?.lat ?? null : null,
        longitude: placeChanged ? place?.point?.lng ?? null : null,
        transport: transport || null,
        slots
      });
      notify(place && !result.located ? 'Salvo, mas o bairro ficou sem ponto no mapa: a distância até as obras não aparece.' : 'Disponibilidade salva.');
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
          <Field label={isSelf ? 'Onde você mora' : 'Onde mora'} htmlFor="availability-place" span>
            <PlaceField
              value={place}
              nucleoCity={nucleoCity}
              onChange={(chosen) => {
                setPlace(chosen);
                setPlaceChanged(true);
                setError(null);
              }}
              onPendingChange={setPlacePending}
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
                  <div className="field__hint avail-stale">
                    Sem ponto no mapa: {canEdit ? 'toque em Editar e escolha o bairro na busca' : 'falta escolher o bairro na busca'}, para a
                    distância até as obras aparecer.
                  </div>
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
