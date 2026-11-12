import type { Activity } from '../../types/api';
import { Avatar } from '../ui/Avatar';
import { peopleLabel, peopleOf } from './taskUtils';

/** Selo "Visita" ao lado do titulo (a visita tem dia, turno e duas pessoas). */
export function VisitBadge({ activity }: { activity: Activity }) {
  return activity.kind === 'Visita' ? <span className="badge badge--visit">Visita</span> : null;
}

/**
 * Quem esta na tarefa: a foto e o nome do responsavel; na visita, as duas fotos sobrepostas e "Ana e Bruno".
 * Sem ninguem, nao mostra nada (quem usa decide o "Sem responsavel").
 */
export function TaskPeople({ activity, size = 22 }: { activity: Activity; size?: number }) {
  const people = peopleOf(activity);
  if (people.length === 0) return null;
  return (
    <span className="task-people">
      <span className="task-people__faces">
        {people.map((person) => (
          <Avatar key={person.id} name={person.name} photoUrl={person.photoUrl} size={size} />
        ))}
      </span>
      <span className="task-people__names">{peopleLabel(activity)}</span>
    </span>
  );
}
