import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { documentsApi, type DocumentOwner } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { SignedDocument } from '../../types/api';
import { formatDate, formatFileSize, todayInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, Loading } from '../ui/Feedback';
import { IconDownload, IconTrash, IconUpload } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface SignedDocumentsPanelProps {
  owner: DocumentOwner;
  title: string;
  /** Uma linha explicando para que serve o documento. */
  description: string;
  /** Texto do botao que baixa o modelo em PDF para assinar. */
  templateLabel: string;
  /** Avisa a pagina quando um documento entra ou sai (para atualizar selos de "pendente"). */
  onChanged?: () => void;
}

/**
 * Documento assinado (termo de adesao do voluntario ou autorizacao de imagem do projeto): baixar o modelo,
 * enviar a copia assinada e abrir o arquivo. So a coordenacao ve; os arquivos nao ficam publicos.
 */
export function SignedDocumentsPanel({ owner, title, description, templateLabel, onChanged }: SignedDocumentsPanelProps) {
  const { notify, notifyError } = useToast();
  const [documents, setDocuments] = useState<SignedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<SignedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { type: ownerType, id: ownerId } = owner;
  const load = useCallback(async () => {
    try {
      setDocuments(await documentsApi.list({ type: ownerType, id: ownerId }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os documentos.');
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateTemplate() {
    setGenerating(true);
    try {
      await documentsApi.downloadTemplate(owner);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível gerar o modelo.');
    } finally {
      setGenerating(false);
    }
  }

  async function open(document: SignedDocument) {
    try {
      await documentsApi.download(document);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível abrir o documento.');
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await documentsApi.remove(removing.id);
      notify('Documento removido.');
      setRemoving(null);
      await load();
      onChanged?.();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível remover o documento.');
    } finally {
      setBusy(false);
    }
  }

  const latest = documents?.[0];

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>{title}</h2>
        {documents ? (
          latest ? (
            <span className="badge badge--done">Assinado em {formatDate(latest.signedOn)}</span>
          ) : (
            <span className="badge badge--pause">Pendente</span>
          )
        ) : null}
      </div>
      <div className="panel__body">
        <p className="field__hint docs__description">{description}</p>

        <div className="btn-row docs__actions">
          <Button small loading={generating} icon={<IconDownload size={15} />} onClick={() => void generateTemplate()}>
            {templateLabel}
          </Button>
          <Button small variant="primary" icon={<IconUpload size={15} />} onClick={() => setUploading(true)}>
            Enviar documento assinado
          </Button>
        </div>

        {error ? (
          <Alert kind="error">{error}</Alert>
        ) : documents === null ? (
          <Loading label="Carregando documentos…" />
        ) : documents.length > 0 ? (
          <ul className="docs__list">
            {documents.map((document) => (
              <li key={document.id} className="docs__item">
                <div className="docs__main">
                  <button type="button" className="row-link docs__name" onClick={() => void open(document)}>
                    {document.fileName}
                  </button>
                  <div className="table__secondary">
                    Assinado em {formatDate(document.signedOn)} · {formatFileSize(document.sizeBytes)}
                    {document.uploadedByName ? ` · enviado por ${document.uploadedByName}` : ''}
                  </div>
                </div>
                <Button
                  small
                  variant="ghost"
                  icon={<IconTrash size={15} />}
                  title="Remover documento"
                  aria-label="Remover documento"
                  onClick={() => setRemoving(document)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <p className="field__hint docs__private">Só a coordenação vê estes documentos; eles não ficam públicos.</p>
      </div>

      {uploading ? (
        <UploadSignedDocumentModal
          owner={owner}
          onClose={() => setUploading(false)}
          onSaved={() => {
            setUploading(false);
            notify('Documento assinado registrado.');
            void load();
            onChanged?.();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Remover documento"
          message={`"${removing.fileName}" será apagado da plataforma.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
        />
      ) : null}
    </section>
  );
}

function UploadSignedDocumentModal({
  owner,
  onClose,
  onSaved
}: {
  owner: DocumentOwner;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [signedOn, setSignedOn] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!file) {
      setError('Selecione o arquivo assinado (PDF, JPG ou PNG).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await documentsApi.upload(owner, file, signedOn);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o documento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Enviar documento assinado"
      subtitle="A cópia assinada (digitalizada ou foto legível) fica guardada só para a coordenação."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Enviar
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="form-grid">
        <Field label="Arquivo" htmlFor="signed-file" required span>
          <input
            id="signed-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Assinado em" htmlFor="signed-on" required span>
          <TextInput
            id="signed-on"
            type="date"
            value={signedOn}
            max={todayInputValue()}
            onChange={(event) => setSignedOn(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
