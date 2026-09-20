import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, assetUrl } from '../../api/client';
import { projectUpdatesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectUpdate } from '../../types/api';
import { fileExtension, formatDateTime, formatFileSize } from '../../utils/format';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconClose, IconDownload, IconEdit, IconTrash, IconUpload } from '../ui/Icons';

interface UpdatesSectionProps {
  project: ProjectDetail;
  onChanged: () => void;
}

export function UpdatesSection({ project, onChanged }: UpdatesSectionProps) {
  const { notify, notifyError } = useToast();
  const [text, setText] = useState('');
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

  function removeStaged(index: number) {
    setStagedFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handlePost(event: FormEvent) {
    event.preventDefault();

    if (text.trim().length < 3) {
      setFormError('Escreva um relato com pelo menos 3 caracteres.');
      return;
    }
    setFormError(null);

    setPosting(true);
    try {
      await projectUpdatesApi.create(project.id, text.trim(), stagedFiles);
      setText('');
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
    <div style={{ marginTop: 24 }}>
      <h3 style={{ marginBottom: 10 }}>Andamento</h3>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body">
          <form onSubmit={handlePost}>
            {formError ? (
              <div style={{ marginBottom: 12 }}>
                <Alert kind="error">{formError}</Alert>
              </div>
            ) : null}

            <TextArea
              placeholder="O que foi feito, decidido ou observado neste projeto…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
            />

            {stagedFiles.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {stagedFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="badge badge--neutral" style={{ gap: 6 }}>
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removeStaged(index)}
                      aria-label={`Remover ${file.name}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                        padding: 0,
                        display: 'inline-flex'
                      }}
                    >
                      <IconClose size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

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
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.dwg,.zip"
              />
              <Button type="submit" variant="primary" small loading={posting}>
                Publicar
              </Button>
            </div>
          </form>
        </div>
      </div>

      {updates.length === 0 ? (
        <EmptyState
          title="Nenhuma atualização registrada"
          description="Registre o que foi feito, decidido ou observado neste projeto."
        />
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
  const { notifyError } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(update.text);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveEdit() {
    if (draft.trim().length < 3) return;
    setSaving(true);
    try {
      await projectUpdatesApi.update(update.id, draft.trim());
      setEditing(false);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar a edição.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      await projectUpdatesApi.addAttachment(update.id, file);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível anexar o arquivo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAttachment(fileId: string) {
    try {
      await projectUpdatesApi.removeAttachment(update.id, fileId);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível remover o anexo.');
    }
  }

  return (
    <article className="panel">
      <div className="panel__body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="table__primary">{update.authorName ?? 'Usuário removido'}</div>
            <div className="table__secondary">
              {formatDateTime(update.createdAt)}
              {update.editedAt ? ' · editado' : ''}
            </div>
          </div>
          <div className="row-actions">
            <Button
              small
              variant="ghost"
              icon={<IconEdit size={15} />}
              title="Editar atualização"
              aria-label="Editar atualização"
              onClick={() => setEditing(true)}
            />
            <Button
              small
              variant="ghost"
              icon={<IconTrash size={15} />}
              title="Excluir atualização"
              aria-label="Excluir atualização"
              onClick={onRemove}
            />
          </div>
        </div>

        {editing ? (
          <div style={{ marginTop: 10 }}>
            <TextArea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
            <div className="row-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
              <Button
                small
                onClick={() => {
                  setEditing(false);
                  setDraft(update.text);
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
          <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{update.text}</p>
        )}

        {update.attachments.length > 0 ? (
          <div className="file-grid" style={{ marginTop: 12 }}>
            {update.attachments.map((file) => (
              <article className="file-card" key={file.id}>
                <div className="file-card__thumb">
                  {file.isImage ? (
                    <img src={assetUrl(file.url)} alt={file.fileName} loading="lazy" />
                  ) : (
                    <span className="file-card__ext">{fileExtension(file.fileName)}</span>
                  )}
                </div>
                <div className="file-card__body">
                  <span className="file-card__name">{file.fileName}</span>
                  <span className="file-card__meta">{formatFileSize(file.sizeBytes)}</span>
                </div>
                <div className="file-card__actions">
                  <a
                    className="btn btn--sm"
                    href={assetUrl(file.url)}
                    target="_blank"
                    rel="noreferrer"
                    download={file.fileName}
                  >
                    <IconDownload size={14} />
                  </a>
                  <Button
                    small
                    variant="ghost"
                    icon={<IconTrash size={14} />}
                    title="Remover anexo"
                    aria-label="Remover anexo"
                    onClick={() => void handleRemoveAttachment(file.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <Button
            type="button"
            small
            variant="ghost"
            icon={<IconUpload size={14} />}
            loading={uploading}
            onClick={() => attachInputRef.current?.click()}
          >
            Anexar mais fotos
          </Button>
          <input ref={attachInputRef} type="file" hidden onChange={(event) => void handleAddAttachment(event)} />
        </div>
      </div>
    </article>
  );
}
