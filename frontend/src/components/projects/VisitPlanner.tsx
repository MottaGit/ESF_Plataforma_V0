import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import type { Shift, VisitCandidate, VisitSuggestions } from '../../types/api';
import { formatNumber, transportLabel, travelTimeLabel, visitDayLabel } from '../../utils/format';
import { useLatestRequest } from '../../utils/useLatestRequest';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

/** Quantas pessoas a lista mostra antes do "Ver todas". */
const VISIBLE = 6;

const availabilityText: Record<VisitCandidate['availability'], string> = {
  Livre: 'livre',
  NaoInformou: 'não preencheu os turnos',
  Ocupado: 'não costuma estar livre'
};

/** "~40 min de carro", "~1h10 de ônibus", "~10 min a pé" ("se for de ônibus" quando a pessoa não informou o meio). */
function travelText(candidate: VisitCandidate) {
  if (candidate.travelMinutes === null || !candidate.travelMode) return null;
  const time = travelTimeLabel(candidate.travelMinutes);
  if (candidate.travelMode === 'APe') return `${time} a pé`;
  if (candidate.travelMode === 'Carro') return `${time} de carro`;
  return candidate.transportAssumed ? `${time} se for de ônibus` : `${time} de ônibus`;
}

/** "Distância em linha reta: 13 km", na dica do mouse sobre o tempo. */
function distanceTitle(candidate: VisitCandidate) {
  if (candidate.distanceKm === null) return undefined;
  const km = candidate.distanceKm < 1 ? 'menos de 1 km' : `${formatNumber(Math.round(candidate.distanceKm))} km`;
  return `Distância em linha reta: ${km}`;
}

/** "livre · ~40 min de carro · Restinga · 2 tarefas": por que a pessoa esta nessa posicao. */
function candidateFacts(candidate: VisitCandidate, projectLocated: boolean) {
  return [
    candidate.otherVisit ? 'já tem outra visita nesse turno' : availabilityText[candidate.availability],
    travelText(candidate) ??
      // Com a obra no mapa, o tempo so falta quando a pessoa nao tem o bairro no mapa.
      (projectLocated ? 'sem bairro no mapa' : null),
    // Sem o tempo, o meio de transporte ainda ajuda a decidir.
    candidate.travelMinutes === null && candidate.transport ? transportLabel(candidate.transport) : null,
    candidate.district,
    candidate.openActivities > 0
      ? `${candidate.openActivities} ${candidate.openActivities === 1 ? 'tarefa' : 'tarefas'}`
      : 'sem tarefas'
  ]
    .filter(Boolean)
    .join(' · ');
}

interface VisitPlannerProps {
  projectId: string;
  /** "2026-11-20" ou vazio. */
  date: string;
  shift: Shift | '';
  /** Visita sendo editada: nao conta como "outra visita" no turno. */
  activityId?: string;
  assignedId: string;
  companionId: string;
  onPickSlot: (date: string, shift: Shift) => void;
  onPickPerson: (volunteerId: string) => void;
  onPickBoth: (first: string, second: string) => void;
}

/**
 * "Quem pode ir" (so a coordenacao): os turnos com mais gente livre nas proximas duas semanas e, com dia e turno,
 * as pessoas na ordem sugerida (livres, mais perto, menos tarefas), com as duas melhores marcadas.
 */
export function VisitPlanner({
  projectId,
  date,
  shift,
  activityId,
  assignedId,
  companionId,
  onPickSlot,
  onPickPerson,
  onPickBoth
}: VisitPlannerProps) {
  const [data, setData] = useState<VisitSuggestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const startRequest = useLatestRequest();

  useEffect(() => {
    const isCurrent = startRequest();
    setError(null);
    activitiesApi
      .visitSuggestions(projectId, { date: date || undefined, shift: shift || undefined, activityId })
      .then((result) => {
        if (!isCurrent()) return;
        setData(result);
        setShowAll(false);
      })
      .catch((err) => isCurrent() && setError(err instanceof ApiError ? err.message : 'Não foi possível buscar as sugestões.'));
  }, [projectId, date, shift, activityId, startRequest]);

  if (error) return <p className="field__hint">{error}</p>;
  if (!data) return null;

  const chosen = new Set([assignedId, companionId].filter(Boolean));
  const suggested = data.candidates.filter((candidate) => candidate.suggested);
  const bothFilled = Boolean(assignedId && companionId);
  const usingSuggestion = suggested.length === 2 && suggested.every((candidate) => chosen.has(candidate.volunteerId));
  const shown = showAll ? data.candidates : data.candidates.slice(0, VISIBLE);

  return (
    <section className="visit-planner" aria-label="Quem pode ir">
      <div className="visit-planner__head">
        <h3>Quem pode ir</h3>
        {suggested.length === 2 && !usingSuggestion ? (
          <Button small variant="primary" onClick={() => onPickBoth(suggested[0].volunteerId, suggested[1].volunteerId)}>
            Usar as 2 sugeridas
          </Button>
        ) : null}
      </div>

      {data.slots.length > 0 ? (
        <div className="visit-planner__slots">
          <span className="field__hint">Turnos com mais gente livre nas próximas 2 semanas:</span>
          <div className="visit-planner__chips">
            {data.slots.map((slot) => {
              const active = slot.date === date && slot.shift === shift;
              return (
                <button
                  key={`${slot.date}-${slot.shift}`}
                  type="button"
                  className={`chip${active ? ' chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onPickSlot(slot.date, slot.shift)}
                >
                  {visitDayLabel(slot.date, slot.shift)} · {slot.available} livres
                  {slot.withCar > 0 ? `, ${slot.withCar} de carro` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!date || !shift ? (
        <p className="field__hint">Escolha o dia e o turno para ver quem está livre e mora mais perto.</p>
      ) : (
        <>
          <ul className="visit-planner__list">
            {shown.map((candidate) => {
              const isChosen = chosen.has(candidate.volunteerId);
              const away = candidate.otherVisit || candidate.availability === 'Ocupado';
              return (
                <li
                  key={candidate.volunteerId}
                  className={`visit-planner__person${away ? ' visit-planner__person--away' : ''}`}
                >
                  <Avatar name={candidate.name} photoUrl={candidate.photoUrl} size={30} />
                  <div className="visit-planner__who">
                    <span className="visit-planner__name">
                      {candidate.name}
                      {candidate.suggested ? <span className="badge badge--visit">Sugerida</span> : null}
                    </span>
                    <span className="visit-planner__facts" title={distanceTitle(candidate)}>
                      {candidateFacts(candidate, data.projectLocated)}
                    </span>
                  </div>
                  <Button
                    small
                    variant={isChosen ? 'ghost' : undefined}
                    aria-pressed={isChosen}
                    onClick={() => onPickPerson(candidate.volunteerId)}
                  >
                    {isChosen ? 'Tirar' : bothFilled ? 'Trocar acompanhante' : 'Escolher'}
                  </Button>
                </li>
              );
            })}
          </ul>
          {data.candidates.length > VISIBLE ? (
            <button type="button" className="link-button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? 'Mostrar menos' : `Ver todas (${data.candidates.length})`}
            </button>
          ) : null}
        </>
      )}

      <p className="field__hint">
        {[
          !data.projectLocated ? 'Marque o local do projeto no mapa (Editar projeto) para ordenar pela distância.' : null,
          data.withoutAvailability > 0
            ? `${data.withoutAvailability} ${data.withoutAvailability === 1 ? 'pessoa ainda não preencheu' : 'pessoas ainda não preencheram'} bairro e turnos.`
            : null,
          'O tempo é uma estimativa pela distância e pelo meio de transporte de cada um, fora do horário de pico: serve para comparar, não é a rota.'
        ]
          .filter(Boolean)
          .join(' ')}
      </p>
    </section>
  );
}
