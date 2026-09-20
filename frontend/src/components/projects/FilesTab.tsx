import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ApiError, assetUrl } from '../../api/client';
import { filesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectFile } from '../../types/api';
import { fileExtension, formatDateTime, formatFileSize } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconDownload, IconTrash, IconUpload } from '../ui/Icons';

interface FilesTabProps {
  project: ProjectDetail;
  onChanged: () => void;
}

export function FilesTab({ project, onChanged }: FilesTabProps) {
  const { notify, notifyError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<ProjectFile | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      await filesApi.upload(project.id, file, description.trim());
      setDescription('');
      notify('Arquivo enviado.');
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void upload(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
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
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body">
          <div className="form-grid">
            <Field label="Descrição do próximo arquivo" htmlFor="file-description" hint="Opcional. Ex.: antes da reforma, telhado da casa 1.">
              <TextInput
                id="file-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="field">
              <span className="field__label">Enviar arquivo</span>
              <div
                className={`dropzone${dragging ? ' dropzone--active' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {uploading ? (
                  'Enviando…'
                ) : (
                  <>
                    Arraste uma foto ou documento aqui
                    <div style={{ marginTop: 8 }}>
                      <Button small icon={<IconUpload size={15} />} onClick={() => inputRef.current?.click()}>
                        Escolher arquivo
                      </Button>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" hidden onChange={handleSelect} />
              </div>
            </div>
          </div>
        </div>
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
                <article className="file-card" key={file.id}>
                  <div className="file-card__thumb">
                    {file.isImage ? (
                      <img src={assetUrl(file.url)} alt={file.description ?? file.fileName} loading="lazy" />
                    ) : (
                      <span className="file-card__ext">{fileExtension(file.fileName)}</span>
                    )}
                  </div>
                  <div className="file-card__body">
                    <span className="file-card__name">{file.description || file.fileName}</span>
                    <span className="file-card__meta">
                      {formatFileSize(file.sizeBytes)} · {formatDateTime(file.uploadedAt)}
                    </span>
                    {file.uploadedByName ? (
                      <span className="file-card__meta">Enviado por {file.uploadedByName}</span>
                    ) : null}
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
                      Baixar
                    </a>
                    <Button
                      small
                      variant="ghost"
                      icon={<IconTrash size={14} />}
                      title="Excluir arquivo"
                      aria-label="Excluir arquivo"
                      onClick={() => setRemoving(file)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {removing ? (
        <ConfirmDialog
          title="Excluir arquivo"
          message={`"${removing.fileName}" será removido do projeto e do servidor.`}
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
