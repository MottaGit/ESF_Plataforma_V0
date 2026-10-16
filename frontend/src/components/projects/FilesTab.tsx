import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ApiError, assetUrl } from '../../api/client';
import { filesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectFile } from '../../types/api';
import { emptyToNull, fileExtension, formatDate, formatDateTime, formatFileSize } from '../../utils/format';
import { NeutralBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconDownload, IconEdit, IconTrash, IconUpload } from '../ui/Icons';

interface FilesTabProps {
  project: ProjectDetail;
  onChanged: () => void;
}

/** Todos os arquivos do projeto num lugar so, inclusive as fotos publicadas no andamento. */
export function FilesTab({ project, onChanged }: FilesTabProps) {
  const { notify, notifyError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<ProjectFile | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadAll(files: File[]) {
    if (files.length === 0) return;

    let sent = 0;
    const failures: string[] = [];
    setProgress({ done: 0, total: files.length });

    for (const file of files) {
      try {
        await filesApi.upload(project.id, file, '');
        sent += 1;
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof ApiError ? err.message : 'falha no envio'}`);
      }
      setProgress({ done: sent + failures.length, total: files.length });
    }

    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    if (sent > 0) notify(sent === 1 ? 'Arquivo enviado.' : `${sent} arquivos enviados.`);
    failures.forEach((message) => notifyError(message));
    onChanged();
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    void uploadAll(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadAll(Array.from(event.dataTransfer.files ?? []));
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await filesApi.remove(removing.id);
      notify('Arquivo excluído.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}`}
        style={{ marginBottom: 16 }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {progress ? (
          `Enviando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
        ) : (
          <>
            Arraste fotos ou documentos para cá (um ou vários de uma vez)
            <div style={{ marginTop: 8 }}>
              <Button small icon={<IconUpload size={15} />} onClick={() => inputRef.current?.click()}>
                Escolher arquivos
              </Button>
            </div>
            <div className="field__hint" style={{ marginTop: 8 }}>
              Até 15 MB por arquivo. As fotos publicadas no Andamento também aparecem aqui.
            </div>
          </>
        )}
        <input ref={inputRef} type="file" multiple hidden onChange={handleSelect} />
      </div>

      <div className="panel">
        {project.files.length === 0 ? (
          <EmptyState
            title="Nenhum arquivo no projeto"
            description="Fotos do antes e depois, plantas, autorizações e listas de presença ficam guardadas aqui."
          />
        ) : (
          <div className="panel__body">
            <div className="file-grid">
              {project.files.map((file) => (
                <FileCard key={file.id} file={file} onChanged={onChanged} onRemove={() => setRemoving(file)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {removing ? (
        <ConfirmDialog
          title="Excluir arquivo"
          message={
            removing.projectUpdateId
              ? `"${removing.fileName}" será removido do projeto e da atualização de andamento em que foi publicado.`
              : `"${removing.fileName}" será removido do projeto e do servidor.`
          }
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

interface FileCardProps {
  file: ProjectFile;
  onChanged: () => void;
  onRemove: () => void;
}

function FileCard({ file, onChanged, onRemove }: FileCardProps) {
  const { notifyError } = useToast();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(file.description ?? '');
  const [saving, setSaving] = useState(false);

  async function saveCaption() {
    setSaving(true);
    try {
      await filesApi.updateDescription(file.id, emptyToNull(caption));
      setEditing(false);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar a legenda.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="file-card">
      <a className="file-card__thumb" href={assetUrl(file.url)} target="_blank" rel="noreferrer" title="Abrir arquivo">
        {file.isImage ? (
          <img src={assetUrl(file.url)} alt={file.description ?? file.fileName} loading="lazy" />
        ) : (
          <span className="file-card__ext">{fileExtension(file.fileName)}</span>
        )}
      </a>
      <div className="file-card__body">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveCaption();
            }}
          >
            <TextInput
              autoFocus
              value={caption}
              maxLength={300}
              placeholder="Legenda (ex.: telhado antes da reforma)"
              aria-label="Legenda do arquivo"
              onChange={(event) => setCaption(event.target.value)}
            />
            <div className="row-actions" style={{ marginTop: 6, justifyContent: 'flex-start' }}>
              <Button small type="submit" variant="primary" loading={saving}>
                Salvar
              </Button>
              <Button
                small
                onClick={() => {
                  setEditing(false);
                  setCaption(file.description ?? '');
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <span className="file-card__name">{file.description || file.fileName}</span>
            {file.description ? <span className="file-card__meta">{file.fileName}</span> : null}
          </>
        )}
        {file.projectUpdateId ? (
          <span>
            <NeutralBadge>
              {file.updateCreatedAt ? `da atualização de ${formatDate(file.updateCreatedAt)}` : 'de uma atualização'}
            </NeutralBadge>
          </span>
        ) : null}
        <span className="file-card__meta">
          {formatFileSize(file.sizeBytes)} · {formatDateTime(file.uploadedAt)}
        </span>
        {file.uploadedByName ? <span className="file-card__meta">Enviado por {file.uploadedByName}</span> : null}
      </div>
      <div className="file-card__actions">
        <a className="btn btn--sm" href={assetUrl(file.url)} target="_blank" rel="noreferrer" download={file.fileName}>
          <IconDownload size={14} />
          Baixar
        </a>
        {!editing ? (
          <Button
            small
            variant="ghost"
            icon={<IconEdit size={14} />}
            title={file.description ? 'Editar legenda' : 'Adicionar legenda'}
            aria-label={file.description ? 'Editar legenda' : 'Adicionar legenda'}
            onClick={() => setEditing(true)}
          />
        ) : null}
        <Button
          small
          variant="ghost"
          icon={<IconTrash size={14} />}
          title="Excluir arquivo"
          aria-label="Excluir arquivo"
          onClick={onRemove}
        />
      </div>
    </article>
  );
}
