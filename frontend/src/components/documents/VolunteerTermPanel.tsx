import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { documentsApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { SignedDocument, Volunteer } from '../../types/api';
import { formatDate, formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { Alert, Loading } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';

/** Enquanto falta o termo: o que acontece agora, conforme a pessoa tenha acesso a plataforma ou nao. */
function pendingText(volunteer: Volunteer, isAdmin: boolean) {
  const firstName = volunteer.name.split(' ')[0];
  if (volunteer.access?.isActive && !volunteer.access.pending)
    return `Aguardando a assinatura online: o pedido aparece no Início de ${firstName}.`;
  if (volunteer.access?.isActive)
    return `Aguardando o primeiro acesso de ${firstName}: ao entrar, o Início pede a assinatura do termo.`;
  return `${firstName} assina online, na própria conta. ${
    isAdmin ? 'Dê acesso à plataforma no painel Acesso' : 'Peça a um administrador para dar acesso à plataforma'
  } para o pedido de assinatura aparecer.`;
}

/**
 * Termo de adesao de um voluntario, visto pela coordenacao: quem assina e o proprio voluntario, online, na conta dele;
 * aqui so a situacao e o download da via assinada.
 */
export function VolunteerTermPanel({ volunteer }: { volunteer: Volunteer }) {
  const { isAdmin } = useAuth();
  const { notifyError } = useToast();
  const [documents, setDocuments] = useState<SignedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentsApi
      .list({ type: 'volunteer', id: volunteer.id })
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o termo.'));
  }, [volunteer.id, volunteer.termSignedOn]);

  async function download(document: SignedDocument) {
    try {
      await documentsApi.download(document);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível baixar o termo.');
    }
  }

  const latest = documents?.[0];

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Termo de adesão e uso de imagem</h2>
        {documents ? (
          latest ? (
            <span className="badge badge--done">Assinado em {formatDate(latest.signedOn)}</span>
          ) : (
            <span className="badge badge--pause">Pendente</span>
          )
        ) : null}
      </div>
      <div className="panel__body">
        {error ? (
          <Alert kind="error">{error}</Alert>
        ) : documents === null ? (
          <Loading label="Carregando…" />
        ) : documents.length === 0 ? (
          <p className="field__hint docs__description">
            Exigido pela Lei do Voluntariado (9.608/98). {pendingText(volunteer, isAdmin)}
          </p>
        ) : (
          <ul className="docs__list">
            {documents.map((document) => (
              <li key={document.id} className="docs__item">
                <div className="docs__main">
                  <button type="button" className="row-link docs__name" onClick={() => void download(document)}>
                    {document.fileName}
                  </button>
                  <div className="table__secondary">
                    {document.signedOnline
                      ? `Assinado online em ${formatDateTime(document.signedAt)}${
                          document.imageAuthorized === false ? ' · não autorizou o uso de imagem' : ''
                        }`
                      : `Assinado em ${formatDate(document.signedOn)}`}
                  </div>
                </div>
                <Button
                  small
                  variant="ghost"
                  icon={<IconDownload size={15} />}
                  title="Baixar PDF"
                  aria-label="Baixar o termo assinado"
                  onClick={() => void download(document)}
                />
              </li>
            ))}
          </ul>
        )}

        <p className="field__hint docs__private">Só a coordenação vê estes documentos; eles não ficam públicos.</p>
      </div>
    </section>
  );
}
