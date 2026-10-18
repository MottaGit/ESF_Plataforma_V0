import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { projectUpdatesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectFile, ProjectUpdate } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconTrash, IconUpload } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { RichTextField, RichTextView, htmlToPlainText } from '../ui/RichText';
import { StagedFiles, UpdateAttachments } from './UpdateAttachments';

const ACCEPTED_FILES = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.dwg,.zip';

interface UpdatesSectionProps {
  project: ProjectDetail;
  onChanged: () => void;
}

export function UpdatesSection({ project, onChanged }: UpdatesSectionProps) {
  const { notify, notifyError } = useToast();
  const [text, setText] = useState('');
  const [plainText, setPlainText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updates = project.updates;

  function handleStageFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setStagedFiles((current) => [...current, ...chosen]);
    event.target.value = '';
  }

  async function handlePost(event: FormEvent) {
    event.preventDefault();

    if (plainText.trim().length < 3) {
      setFormError('Escreva um relato com pelo menos 3 caracteres.');
      return;
    }
    setFormError(null);

    setPosting(true);
    try {
      await projectUpdatesApi.create(project.id, text, stagedFiles);
      setText('');
      setPlainText('');
      setStagedFiles([]);
      notify('Atualização publicada.');
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível publicar a atualização.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await projectUpdatesApi.remove(removing.id);
      notify('Atualização excluída.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir a atualização.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body">
          <form onSubmit={handlePost}>
            {formError ? (
              <div style={{ marginBottom: 12 }}>
                <Alert kind="error">{formError}</Alert>
              </div>
            ) : null}

            <div className="field__label" style={{ marginBottom: 6 }}>
              O que aconteceu?
            </div>
            <RichTextField
              value={text}
              ariaLabel="O que aconteceu?"
              placeholder="Conte o que foi feito, decidido ou observado neste projeto…"
              onChange={(html, plain) => {
                setText(html);
                setPlainText(plain);
              }}
            />

            <StagedFiles
              files={stagedFiles}
              onRemove={(index) => setStagedFiles((current) => current.filter((_, i) => i !== index))}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
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
                Publicar
              </Button>
            </div>
          </form>
        </div>
      </div>

      {updates.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nenhuma atualização registrada"
            description="O andamento do projeto aparece aqui, do mais recente para o mais antigo."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {updates.map((update) => (
            <UpdateCard key={update.id} update={update} onChanged={onChanged} onRemove={() => setRemoving(update)} />
          ))}
        </div>
      )}

      {removing ? (
        <ConfirmDialog
          title="Excluir atualização"
          message="Esse relato e os arquivos anexados a ele serão removidos definitivamente."
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
  const [draftPlain, setDraftPlain] = useState(() => htmlToPlainText(update.text));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingFile, setRemovingFile] = useState<ProjectFile | null>(null);
  const [busy, setBusy] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveEdit() {
    if (draftPlain.trim().length < 3) {
      notifyError('Escreva um relato com pelo menos 3 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await projectUpdatesApi.update(update.id, draft);
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
          <div>
            <div className="table__primary">{update.authorName ?? 'Usuário removido'}</div>
            <div className="table__secondary">
              {formatDateTime(update.createdAt)}
              {update.editedAt ? ' · editado' : ''}
              {uploading ? ' · enviando anexos…' : ''}
            </div>
          </div>
          <Menu
            label="Ações da atualização"
            items={[
              { label: 'Editar', icon: <IconEdit size={14} />, onSelect: () => setEditing(true) },
              { label: 'Anexar fotos', icon: <IconUpload size={14} />, onSelect: () => attachInputRef.current?.click() },
              { label: 'Excluir', icon: <IconTrash size={14} />, danger: true, onSelect: onRemove }
            ]}
          />
          <input ref={attachInputRef} type="file" multiple hidden accept={ACCEPTED_FILES} onChange={handleAddAttachments} />
        </div>

        {editing ? (
          <div style={{ marginTop: 10 }}>
            <RichTextField
              value={draft}
              ariaLabel="Editar relato"
              autoFocus
              onChange={(html, plain) => {
                setDraft(html);
                setDraftPlain(plain);
              }}
            />
            <UpdateAttachments files={update.attachments} onRemove={setRemovingFile} />
            <div className="row-actions" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <Button
                small
                onClick={() => {
                  setEditing(false);
                  setDraft(update.text);
                  setDraftPlain(htmlToPlainText(update.text));
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
          message={`"${removingFile.fileName}" será removido desta atualização e dos arquivos do projeto.`}
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
