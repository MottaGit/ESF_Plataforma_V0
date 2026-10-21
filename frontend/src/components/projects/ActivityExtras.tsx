import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, assetUrl } from '../../api/client';
import { activitiesApi, filesApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Activity, ActivityDetails, ProjectFile } from '../../types/api';
import { formatFileSize } from '../../utils/format';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { ConfirmDialog, Loading } from '../ui/Feedback';
import { IconClose, IconPaperclip, IconUpload } from '../ui/Icons';
import { ActivityComments } from './ActivityComments';

interface ActivityExtrasProps {
  activity: Activity;
  /** Avisa que algo mudou (o card e a lista atualizam os contadores ao fechar). */
  onChanged: () => void;
}

/**
 * Coluna da direita da janela da atividade: checklist, anexos e comentarios. Cada mudanca grava na hora, sem
 * depender do "Salvar" do formulario.
 */
export function ActivityExtras({ activity, onChanged }: ActivityExtrasProps) {
  const { notifyError } = useToast();
  const [details, setDetails] = useState<ActivityDetails | null>(null);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingFile, setRemovingFile] = useState<ProjectFile | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setDetails(await activitiesApi.details(activity.id));
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível carregar o checklist e os anexos.');
    }
  }, [activity.id, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  function fail(err: unknown, fallback: string) {
    notifyError(err instanceof ApiError ? err.message : fallback);
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    const text = newItem.trim();
    if (!text || !details) return;
    setAdding(true);
    try {
      const item = await activitiesApi.addChecklistItem(activity.id, text);
      setDetails({ ...details, checklist: [...details.checklist, item] });
      setNewItem('');
      onChanged();
    } catch (err) {
      fail(err, 'Não foi possível incluir o item.');
    } finally {
      setAdding(false);
    }
  }

  async function toggleItem(id: string, done: boolean) {
    if (!details) return;
    // Marca na hora; se a API recusar, volta.
    const before = details;
    setDetails({ ...details, checklist: details.checklist.map((item) => (item.id === id ? { ...item, done } : item)) });
    try {
      await activitiesApi.updateChecklistItem(id, { done });
      onChanged();
    } catch (err) {
      setDetails(before);
      fail(err, 'Não foi possível atualizar o item.');
    }
  }

  async function removeItem(id: string) {
    if (!details) return;
    try {
      await activitiesApi.removeChecklistItem(id);
      setDetails({ ...details, checklist: details.checklist.filter((item) => item.id !== id) });
      onChanged();
    } catch (err) {
      fail(err, 'Não foi possível remover o item.');
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      const sent: ProjectFile[] = [];
      for (const file of files) sent.push(await filesApi.upload(activity.projectId, file, '', activity.id));
      setDetails((current) => (current ? { ...current, attachments: [...current.attachments, ...sent] } : current));
      onChanged();
    } catch (err) {
      fail(err, 'Não foi possível anexar o arquivo.');
      void load();
    } finally {
      setUploading(false);
    }
  }

  async function removeFile() {
    if (!removingFile || !details) return;
    setBusy(true);
    try {
      await filesApi.remove(removingFile.id);
      setDetails({ ...details, attachments: details.attachments.filter((file) => file.id !== removingFile.id) });
      setRemovingFile(null);
      onChanged();
    } catch (err) {
      fail(err, 'Não foi possível remover o anexo.');
    } finally {
      setBusy(false);
    }
  }

  if (!details) return <Loading label="Carregando…" />;

  const total = details.checklist.length;
  const done = details.checklist.filter((item) => item.done).length;

  return (
    <div className="extras">
      <section className="extras__section">
        <div className="extras__head">
          <h3>Checklist</h3>
          {total > 0 ? <span className="extras__count num">{done}/{total}</span> : null}
        </div>
        {total > 0 ? (
          <div className="extras__progress" aria-hidden="true">
            <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        ) : null}
        <ul className="checklist">
          {details.checklist.map((item) => (
            <li key={item.id} className={`checklist__item${item.done ? ' checklist__item--done' : ''}`}>
              <label>
                <input type="checkbox" checked={item.done} onChange={(event) => void toggleItem(item.id, event.target.checked)} />
                <span>{item.text}</span>
              </label>
              <button
                type="button"
                className="extras__remove"
                aria-label={`Remover "${item.text}"`}
                title="Remover item"
                onClick={() => void removeItem(item.id)}
              >
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form className="checklist__add" onSubmit={addItem}>
          <TextInput
            value={newItem}
            maxLength={300}
            placeholder="Adicionar item"
            aria-label="Novo item do checklist"
            onChange={(event) => setNewItem(event.target.value)}
          />
          <Button type="submit" small loading={adding} disabled={!newItem.trim()}>
            Adicionar
          </Button>
        </form>
      </section>

      <section className="extras__section">
        <div className="extras__head">
          <h3>Anexos</h3>
          {details.attachments.length > 0 ? (
            <span className="extras__count num">{details.attachments.length}</span>
          ) : null}
        </div>
        {details.attachments.length > 0 ? (
          <ul className="attachments">
            {details.attachments.map((file) => (
              <li key={file.id}>
                <a href={assetUrl(file.url)} target="_blank" rel="noreferrer" className="attachments__link">
                  {file.isImage ? (
                    <img src={assetUrl(file.url)} alt="" className="attachments__thumb" />
                  ) : (
                    <span className="attachments__icon">
                      <IconPaperclip size={15} />
                    </span>
                  )}
                  <span className="attachments__name">{file.fileName}</span>
                </a>
                <span className="attachments__size">{formatFileSize(file.sizeBytes)}</span>
                <button
                  type="button"
                  className="extras__remove"
                  aria-label={`Remover o anexo ${file.fileName}`}
                  title="Remover anexo"
                  onClick={() => setRemovingFile(file)}
                >
                  <IconClose size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input ref={fileInput} type="file" multiple hidden onChange={(event) => void upload(event)} />
        <Button small icon={<IconUpload size={14} />} loading={uploading} onClick={() => fileInput.current?.click()}>
          Anexar arquivo
        </Button>
        <p className="field__hint extras__hint">Os anexos também aparecem na aba Arquivos do projeto.</p>
      </section>

      <ActivityComments activityId={activity.id} initial={details.comments} onChanged={onChanged} />

      {removingFile ? (
        <ConfirmDialog
          title="Remover anexo"
          message={`"${removingFile.fileName}" será apagado da tarefa e da aba Arquivos do projeto.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemovingFile(null)}
          onConfirm={() => void removeFile()}
        />
      ) : null}
    </div>
  );
}
