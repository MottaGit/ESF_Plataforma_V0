import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { UPDATES_PAGE_SIZE, projectUpdatesApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectFile, ProjectUpdate, ProjectUpdatePage } from '../../types/api';
import { clearDraft, loadDraft, progressDraftKey, saveDraft } from '../../utils/drafts';
import {
  SENSITIVE_DATA_HINT,
  formatDate,
  formatDateTime,
  formatHours,
  timeAgoPhrase,
  todayInputValue
} from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../ui/Feedback';
import { IconEdit, IconTrash, IconUpload } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { RichTextField, RichTextView, htmlToPlainText } from '../ui/RichText';
import { StagedFiles, UpdateAttachments } from './UpdateAttachments';

const ACCEPTED_FILES = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.dwg,.zip';

/** Dia (aaaa-mm-dd) somado de n dias, sem passar por fuso. */
function shiftDay(day: string, days: number) {
  const [year, month, date] = day.split('-').map(Number);
  const moved = new Date(year, month - 1, date + days);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`;
}

/** O dia em que aconteceu e o mesmo em que foi publicado (no relogio de quem esta vendo)? */
function sameDay(happenedOn: string, createdAt: string) {
  const created = new Date(createdAt);
  const local = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  return happenedOn.slice(0, 10) === local;
}

interface UpdatesSectionProps {
  project: ProjectDetail;
  onChanged: () => void;
  /** Veio de um "Registrar": rola ate o campo e ja deixa o cursor nele. */
  focusComposer?: boolean;
}

export function UpdatesSection({ project, onChanged, focusComposer }: UpdatesSectionProps) {
  const composerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusComposer) composerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focusComposer]);

  const { user } = useAuth();
  const { notify, notifyError } = useToast();
  // Rascunho guardado no aparelho: o texto volta ao abrir o projeto de novo (trocar de tela, recarregar, sessao vencida).
  const draftKey = user ? progressDraftKey(user.id, project.id) : null;
  const [restoredDraft, setRestoredDraft] = useState(() => (draftKey ? loadDraft(draftKey) : null));
  const [text, setText] = useState(restoredDraft?.html ?? '');
  // Horas do dia (opcional), so para quem esta na equipe: viram um lancamento de horas no projeto.
  const [hours, setHours] = useState(restoredDraft?.hours ?? '');
  // Dia em que aconteceu: hoje por padrao; o mutirao de sabado registrado na segunda fica no sabado (no relatorio
  // tambem). Volta do rascunho quando foi escolhido outro dia.
  const today = todayInputValue();
  const yesterday = shiftDay(today, -1);
  const [day, setDay] = useState(restoredDraft?.day ?? today);
  const inTeam = project.volunteers.some((member) => member.volunteerId === user?.volunteerId);
  const [plainText, setPlainText] = useState(() => (restoredDraft ? htmlToPlainText(restoredDraft.html) : ''));
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Os registros vem pela rota propria, uma pagina por vez (o projeto so traz quantos sao).
  const [page, setPage] = useState<ProjectUpdatePage | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Quantos a tela mostra: ao recarregar, continuam abertos os que a pessoa ja tinha visto.
  const shownRef = useRef(UPDATES_PAGE_SIZE);

  // Recarrega a cada versao nova do projeto: ele e recarregado depois de toda mudanca (publicar, editar, excluir,
  // anexar, encerrar o projeto com registro).
  useEffect(() => {
    let active = true;
    projectUpdatesApi
      .listByProject(project.id, 0, Math.min(100, Math.max(UPDATES_PAGE_SIZE, shownRef.current)))
      .then((result) => {
        if (!active) return;
        setPage(result);
        setListError(null);
      })
      .catch((err) => {
        if (active) setListError(err instanceof ApiError ? err.message : 'Não foi possível carregar os registros.');
      });
    return () => {
      active = false;
    };
  }, [project, attempt]);

  useEffect(() => {
    if (page) shownRef.current = page.items.length;
  }, [page]);

  async function loadMore() {
    if (!page) return;
    setLoadingMore(true);
    try {
      const next = await projectUpdatesApi.listByProject(project.id, page.items.length);
      setPage((current) => {
        if (!current) return next;
        const known = new Set(current.items.map((item) => item.id));
        return { items: [...current.items, ...next.items.filter((item) => !known.has(item.id))], total: next.total };
      });
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível carregar os registros anteriores.');
    } finally {
      setLoadingMore(false);
    }
  }

  const updates = page?.items ?? [];
  const olderCount = page ? Math.max(0, page.total - page.items.length) : 0;

  // Grava a cada mudanca (sem esperar: quem sai da tela logo depois de digitar nao perde a ultima frase).
  useEffect(() => {
    if (!draftKey) return;
    if (plainText.trim() === '' && hours.trim() === '') clearDraft(draftKey);
    else saveDraft(draftKey, text, hours, day !== today ? day : undefined);
  }, [draftKey, text, plainText, hours, day, today]);

  function discardDraft() {
    setText('');
    setPlainText('');
    setHours('');
    setDay(today);
    setRestoredDraft(null);
    if (draftKey) clearDraft(draftKey);
  }

  function handleStageFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setStagedFiles((current) => [...current, ...chosen]);
    event.target.value = '';
  }

  async function handlePost(event: FormEvent) {
    event.preventDefault();

    if (plainText.trim().length < 3) {
      setFormError('O registro precisa ter pelo menos 3 caracteres.');
      return;
    }
    const hoursValue = hours.trim() === '' ? null : Number(hours.replace(',', '.'));
    if (hoursValue !== null && !(hoursValue > 0 && hoursValue <= 24)) {
      setFormError('Informe de 0,25 a 24 horas (ou deixe as horas em branco).');
      return;
    }
    if (day && day > today) {
      setFormError('A data do registro não pode ser depois de hoje.');
      return;
    }
    setFormError(null);

    setPosting(true);
    try {
      await projectUpdatesApi.create(project.id, text, stagedFiles, hoursValue, day || today);
      setText('');
      setPlainText('');
      setStagedFiles([]);
      setHours('');
      setDay(today);
      setRestoredDraft(null);
      if (draftKey) clearDraft(draftKey);
      notify(hoursValue ? `Registro publicado, com ${formatHours(hoursValue)} lançadas.` : 'Registro publicado.');
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível publicar o registro.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await projectUpdatesApi.remove(removing.id);
      notify('Registro excluído.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o registro.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel composer-panel mb-16" ref={composerRef}>
        <div className="panel__body">
          <form onSubmit={handlePost}>
            {formError ? (
              <div className="mb-12">
                <Alert kind="error">{formError}</Alert>
              </div>
            ) : null}

            <div className="field__label mb-8">
              Registrar andamento
            </div>
            <RichTextField
              value={text}
              autoFocus={focusComposer}
              ariaLabel="Registrar andamento"
              placeholder="Conte o que foi feito, o que foi decidido ou o que mudou no projeto…"
              onChange={(html, plain) => {
                setText(html);
                setPlainText(plain);
              }}
            />

            {restoredDraft && plainText.trim() !== '' ? (
              <p className="field__hint composer-draft">
                Rascunho guardado neste aparelho {timeAgoPhrase(new Date(restoredDraft.savedAt).toISOString())}.{' '}
                <button type="button" className="link-button" onClick={discardDraft}>
                  Descartar rascunho
                </button>
              </p>
            ) : null}

            <StagedFiles
              files={stagedFiles}
              onRemove={(index) => setStagedFiles((current) => current.filter((_, i) => i !== index))}
            />

            <p className="field__hint mt-8">
              {SENSITIVE_DATA_HINT} Fotos de pessoas, só com autorização de uso de imagem.
            </p>

            <div className="composer-hours">
              <label htmlFor="update-day">Quando aconteceu</label>
              <TextInput
                id="update-day"
                type="date"
                max={today}
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
              {day !== today ? (
                <button type="button" className="chip" onClick={() => setDay(today)}>
                  hoje
                </button>
              ) : null}
              {day !== yesterday ? (
                <button type="button" className="chip" onClick={() => setDay(yesterday)}>
                  ontem
                </button>
              ) : null}
            </div>

            {inTeam ? (
              <div className="composer-hours">
                <label htmlFor="update-hours">{day === today ? 'Suas horas hoje' : 'Suas horas nesse dia'}</label>
                <TextInput
                  id="update-hours"
                  inputMode="decimal"
                  placeholder="opcional"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
                <span className="field__hint">entram nas horas do projeto, com este registro como o que você fez</span>
              </div>
            ) : null}

            <div className="row-between mt-12">
              <Button type="button" small icon={<IconUpload size={15} />} onClick={() => fileInputRef.current?.click()}>
                Anexar fotos
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleStageFiles}
                accept={ACCEPTED_FILES}
              />
              <Button type="submit" variant="primary" small loading={posting}>
                Publicar registro
              </Button>
            </div>
          </form>
        </div>
      </div>

      {listError && !page ? (
        <Alert kind="error">
          {listError}{' '}
          <button type="button" className="btn btn--sm ml-8" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </Alert>
      ) : !page ? (
        <Loading label="Carregando registros…" />
      ) : updates.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhum registro ainda"
            description="O andamento do projeto aparece aqui, do mais recente para o mais antigo."
          />
        </div>
      ) : (
        <div className="stack stack--tight">
          {updates.map((update) => (
            <UpdateCard key={update.id} update={update} onChanged={onChanged} onRemove={() => setRemoving(update)} />
          ))}
          {olderCount > 0 ? (
            <div className="feed-more">
              <Button loading={loadingMore} onClick={() => void loadMore()}>
                Ver registros anteriores ({olderCount})
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {removing ? (
        <ConfirmDialog
          title="Excluir registro"
          message="Esse registro e os arquivos anexados a ele serão removidos definitivamente."
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}

interface UpdateCardProps {
  update: ProjectUpdate;
  onChanged: () => void;
  onRemove: () => void;
}

function UpdateCard({ update, onChanged, onRemove }: UpdateCardProps) {
  const { notify, notifyError } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(update.text);
  const [draftDay, setDraftDay] = useState(update.happenedOn.slice(0, 10));
  const [draftPlain, setDraftPlain] = useState(() => htmlToPlainText(update.text));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingFile, setRemovingFile] = useState<ProjectFile | null>(null);
  const [busy, setBusy] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveEdit() {
    if (draftPlain.trim().length < 3) {
      notifyError('O registro precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (draftDay > todayInputValue()) {
      notifyError('A data do registro não pode ser depois de hoje.');
      return;
    }
    setSaving(true);
    try {
      await projectUpdatesApi.update(update.id, draft, draftDay || null);
      setEditing(false);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar a edição.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setUploading(true);
    let sent = 0;
    for (const file of files) {
      try {
        await projectUpdatesApi.addAttachment(update.id, file);
        sent += 1;
      } catch (err) {
        notifyError(`${file.name}: ${err instanceof ApiError ? err.message : 'não foi possível anexar.'}`);
      }
    }
    setUploading(false);
    if (sent > 0) notify(sent === 1 ? 'Arquivo anexado.' : `${sent} arquivos anexados.`);
    onChanged();
  }

  async function handleRemoveAttachment() {
    if (!removingFile) return;
    setBusy(true);
    try {
      await projectUpdatesApi.removeAttachment(update.id, removingFile.id);
      setRemovingFile(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível remover o anexo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel__body">
        <div className="update-card__head">
          <div className="person-cell">
            <Avatar name={update.authorName ?? '?'} photoUrl={update.authorPhotoUrl} size={34} />
            <div>
              <div className="table__primary">{update.authorName ?? 'Usuário removido'}</div>
              <div className="table__secondary">
                {/* O dia em que aconteceu; quando foi registrado em outro dia, as duas datas. */}
                {sameDay(update.happenedOn, update.createdAt)
                  ? formatDateTime(update.createdAt)
                  : `${formatDate(update.happenedOn)} · registrado em ${formatDateTime(update.createdAt)}`}
                {update.editedAt ? ' · editado' : ''}
                {uploading ? ' · enviando anexos…' : ''}
              </div>
            </div>
          </div>
          <Menu
            label="Ações do registro"
            items={[
              { label: 'Editar', icon: <IconEdit size={14} />, onSelect: () => setEditing(true) },
              { label: 'Anexar fotos', icon: <IconUpload size={14} />, onSelect: () => attachInputRef.current?.click() },
              { label: 'Excluir', icon: <IconTrash size={14} />, danger: true, onSelect: onRemove }
            ]}
          />
          <input ref={attachInputRef} type="file" multiple hidden accept={ACCEPTED_FILES} onChange={handleAddAttachments} />
        </div>

        {editing ? (
          <div className="mt-12">
            <RichTextField
              value={draft}
              ariaLabel="Editar registro"
              autoFocus
              onChange={(html, plain) => {
                setDraft(html);
                setDraftPlain(plain);
              }}
            />
            <div className="composer-hours">
              <label htmlFor={`update-day-${update.id}`}>Quando aconteceu</label>
              <TextInput
                id={`update-day-${update.id}`}
                type="date"
                max={todayInputValue()}
                value={draftDay}
                onChange={(event) => setDraftDay(event.target.value)}
              />
            </div>
            <UpdateAttachments files={update.attachments} onRemove={setRemovingFile} />
            <div className="row-actions mt-12 justify-end">
              <Button
                small
                onClick={() => {
                  setEditing(false);
                  setDraft(update.text);
                  setDraftPlain(htmlToPlainText(update.text));
                  setDraftDay(update.happenedOn.slice(0, 10));
                }}
              >
                Cancelar
              </Button>
              <Button small variant="primary" loading={saving} onClick={() => void handleSaveEdit()}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <RichTextView className="update-card__text" html={update.text} />
            <UpdateAttachments files={update.attachments} />
          </>
        )}
      </div>

      {removingFile ? (
        <ConfirmDialog
          title="Remover anexo"
          message={`"${removingFile.fileName}" será removido deste registro e dos arquivos do projeto.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemovingFile(null)}
          onConfirm={() => void handleRemoveAttachment()}
        />
      ) : null}
    </article>
  );
}
