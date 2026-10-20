import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ActivityComment, Mention, Mentionable } from '../../types/api';
import { SENSITIVE_DATA_HINT, formatDateTime, timeAgo } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Feedback';

/** Sem acento e em minusculas, para achar "Joao" digitando "joão" e vice-versa. */
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Texto do comentario com as mencoes (@Nome) destacadas. */
function withMentions(text: string, mentions: Mention[]): ReactNode {
  if (mentions.length === 0) return text;
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length).map((m) => escapeRegExp(`@${m.name}`));
  return text.split(new RegExp(`(${names.join('|')})`, 'g')).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="mention">
        {part}
      </span>
    ) : (
      part
    )
  );
}

interface ActivityCommentsProps {
  activityId: string;
  initial: ActivityComment[];
  onChanged: () => void;
}

/** Comentarios da atividade: lista, escrever com @mencao, editar e apagar. */
export function ActivityComments({ activityId, initial, onChanged }: ActivityCommentsProps) {
  const { notifyError } = useToast();
  const [comments, setComments] = useState(initial);
  const [people, setPeople] = useState<Mentionable[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ActivityComment | null>(null);
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLLIElement>(null);

  useEffect(() => {
    activitiesApi.mentionable(activityId).then(setPeople).catch(() => undefined);
  }, [activityId]);

  async function add(text: string, mentions: string[]) {
    const created = await activitiesApi.addComment(activityId, { text, mentionedVolunteerIds: mentions });
    setComments((current) => [...current, created]);
    onChanged();
    window.setTimeout(() => listEnd.current?.scrollIntoView({ block: 'nearest' }), 0);
  }

  async function update(id: string, text: string, mentions: string[]) {
    const saved = await activitiesApi.updateComment(id, { text, mentionedVolunteerIds: mentions });
    setComments((current) => current.map((comment) => (comment.id === id ? saved : comment)));
    setEditingId(null);
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await activitiesApi.removeComment(removing.id);
      setComments((current) => current.filter((comment) => comment.id !== removing.id));
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível apagar o comentário.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="extras__section">
      <div className="extras__head">
        <h3>Comentários</h3>
        {comments.length > 0 ? <span className="extras__count num">{comments.length}</span> : null}
      </div>

      {comments.length > 0 ? (
        <ul className="comments">
          {comments.map((comment) =>
            editingId === comment.id ? (
              <li key={comment.id}>
                <CommentComposer
                  people={people}
                  initialText={comment.text}
                  initialMentions={comment.mentions}
                  submitLabel="Salvar"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(text, mentions) => update(comment.id, text, mentions)}
                />
              </li>
            ) : (
              <li key={comment.id} className="comment">
                <Avatar name={comment.authorName} photoUrl={comment.authorPhotoUrl} size={26} />
                <div className="comment__body">
                  <div className="comment__head">
                    <strong>{comment.authorName}</strong>
                    <span title={formatDateTime(comment.createdAt)}>{timeAgo(comment.createdAt)}</span>
                    {comment.editedAt ? <span title={formatDateTime(comment.editedAt)}>(editado)</span> : null}
                  </div>
                  <p className="comment__text">{withMentions(comment.text, comment.mentions)}</p>
                  {comment.canEdit || comment.canDelete ? (
                    <div className="comment__actions">
                      {comment.canEdit ? (
                        <button type="button" onClick={() => setEditingId(comment.id)}>
                          Editar
                        </button>
                      ) : null}
                      {comment.canDelete ? (
                        <button type="button" onClick={() => setRemoving(comment)}>
                          Apagar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          )}
          <li ref={listEnd} aria-hidden="true" className="comments__end" />
        </ul>
      ) : null}

      {editingId === null ? (
        <CommentComposer people={people} submitLabel="Comentar" onSubmit={(text, mentions) => add(text, mentions)} />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Apagar comentário"
          message="O comentário sai da atividade. Essa ação não pode ser desfeita."
          confirmLabel="Apagar"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </section>
  );
}

interface CommentComposerProps {
  people: Mentionable[];
  initialText?: string;
  initialMentions?: Mention[];
  submitLabel: string;
  onCancel?: () => void;
  /** Rejeita com o erro da API (a mensagem aparece no toast e o texto fica). */
  onSubmit: (text: string, mentionedVolunteerIds: string[]) => Promise<void>;
}

/**
 * Caixa de comentario. Digitar @ abre a lista de pessoas (a equipe do projeto primeiro); escolher insere o nome.
 * Ctrl+Enter envia.
 */
function CommentComposer({ people, initialText = '', initialMentions = [], submitLabel, onCancel, onSubmit }: CommentComposerProps) {
  const { notifyError } = useToast();
  const [text, setText] = useState(initialText);
  const [mentions, setMentions] = useState<Mention[]>(initialMentions);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  const suggestions =
    query === null
      ? []
      : people.filter((person) => fold(person.name).includes(fold(query))).slice(0, 6);

  /** O "@algo" logo antes do cursor, se houver. */
  function mentionQuery(value: string, caret: number) {
    const match = /(?:^|\s)@([\p{L}\p{M}'.-]*)$/u.exec(value.slice(0, caret));
    return match ? match[1] : null;
  }

  function change(value: string) {
    setText(value);
    setQuery(mentionQuery(value, input.current?.selectionStart ?? value.length));
    setHighlight(0);
  }

  function choose(person: Mentionable) {
    const field = input.current;
    const caret = field?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}\p{M}'.-]*)$/u, `@${person.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentions((current) =>
      current.some((m) => m.volunteerId === person.volunteerId)
        ? current
        : [...current, { volunteerId: person.volunteerId, name: person.name }]
    );
    setQuery(null);
    window.setTimeout(() => {
      field?.focus();
      field?.setSelectionRange(before.length, before.length);
    }, 0);
  }

  async function submit() {
    const value = text.trim();
    if (!value || sending) return;
    // So conta quem continua mencionado no texto.
    const ids = mentions.filter((m) => value.includes(`@${m.name}`)).map((m) => m.volunteerId);
    setSending(true);
    try {
      await onSubmit(value, ids);
      if (!onCancel) {
        setText('');
        setMentions([]);
      }
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível enviar o comentário.');
    } finally {
      setSending(false);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight((current) => (current + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(suggestions[highlight]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="composer">
      <div className="composer__field">
        <textarea
          ref={input}
          className="textarea composer__input"
          rows={2}
          maxLength={2000}
          value={text}
          placeholder="Escreva um comentário… use @ para mencionar alguém"
          aria-label="Comentário"
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          onBlur={() => window.setTimeout(() => setQuery(null), 150)}
        />
        {suggestions.length > 0 ? (
          <ul className="mention-list" role="listbox" aria-label="Pessoas para mencionar">
            {suggestions.map((person, index) => (
              <li key={person.volunteerId} role="option" aria-selected={index === highlight}>
                <button
                  type="button"
                  className={index === highlight ? 'mention-list__option--active' : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(person);
                  }}
                >
                  <Avatar name={person.name} photoUrl={person.photoUrl} size={20} />
                  {person.name}
                  {person.inTeam ? <span className="mention-list__tag">equipe</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="composer__foot">
        <span className="field__hint composer__hint">{SENSITIVE_DATA_HINT}</span>
        {onCancel ? (
          <Button small variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button small variant="primary" loading={sending} disabled={!text.trim()} onClick={() => void submit()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
