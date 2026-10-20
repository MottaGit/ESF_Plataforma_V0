import type { Activity } from '../../types/api';
import { IconChecklist, IconComment, IconPaperclip } from '../ui/Icons';

interface ActivityCountersProps {
  activity: Activity;
  /** Com onClick, o resumo vira um botao que abre a atividade. */
  onClick?: () => void;
}

/** Resumo do que fica dentro da atividade: checklist (3/5), anexos e comentarios. Nada aparece quando esta tudo vazio. */
export function ActivityCounters({ activity, onClick }: ActivityCountersProps) {
  const items = [];
  if (activity.checklistTotal > 0) {
    const complete = activity.checklistDone === activity.checklistTotal;
    items.push(
      <span
        key="checklist"
        className={`activity-counters__item${complete ? ' activity-counters__item--done' : ''}`}
        title={`Checklist: ${activity.checklistDone} de ${activity.checklistTotal} feitos`}
      >
        <IconChecklist size={14} />
        {activity.checklistDone}/{activity.checklistTotal}
      </span>
    );
  }
  if (activity.attachmentsCount > 0) {
    items.push(
      <span key="attachments" className="activity-counters__item" title={`${activity.attachmentsCount} anexo(s)`}>
        <IconPaperclip size={14} />
        {activity.attachmentsCount}
      </span>
    );
  }
  if (activity.commentsCount > 0) {
    items.push(
      <span key="comments" className="activity-counters__item" title={`${activity.commentsCount} comentário(s)`}>
        <IconComment size={14} />
        {activity.commentsCount}
      </span>
    );
  }
  if (items.length === 0) return null;

  return onClick ? (
    <button
      type="button"
      className="activity-counters activity-counters--button"
      aria-label={`Abrir "${activity.title}" (checklist, anexos e comentários)`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {items}
    </button>
  ) : (
    <span className="activity-counters">{items}</span>
  );
}
