import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { myTermApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { MyTerm } from '../../types/api';
import { formatDate, formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { IconDownload } from '../ui/Icons';
import { SignTermDialog } from './SignTermDialog';

/** Termo do voluntario logado (null enquanto carrega ou quando o acesso nao tem voluntario). */
function useMyTerm(enabled: boolean) {
  const [term, setTerm] = useState<MyTerm | null>(null);
  useEffect(() => {
    if (!enabled) return;
    myTermApi
      .get()
      .then(setTerm)
      .catch(() => setTerm(null));
  }, [enabled]);
  return [term, setTerm] as const;
}

/** "Assinado online em 04/11/2026, 17:46" ou "Entregue à coordenação, assinado em 04/11/2026". */
function signedLabel(signed: NonNullable<MyTerm['signed']>) {
  return signed.signedOnline
    ? `Assinado online em ${formatDateTime(signed.signedAt)}`
    : `Assinado em ${formatDate(signed.signedOn)} e entregue à coordenação`;
}

/**
 * Aviso no Inicio para o voluntario ativo ou afastado que ainda nao assinou o termo de adesao. Some depois da
 * assinatura.
 */
export function TermCallout({ volunteerId }: { volunteerId: string | null }) {
  const { notify } = useToast();
  const [term, setTerm] = useMyTerm(Boolean(volunteerId));
  const [open, setOpen] = useState(false);

  if (!term?.pending && !open) return null;

  return (
    <>
      {term?.pending ? (
        <section className="term-callout" aria-label="Termo de adesão">
          <div>
            <strong>Assine seu termo de adesão</strong>
            <p>A Lei do Voluntariado pede um termo assinado. Dá para ler e assinar aqui mesmo, em um minuto.</p>
          </div>
          <Button variant="primary" onClick={() => setOpen(true)}>
            Ler e assinar
          </Button>
        </section>
      ) : null}
      {open && term ? (
        <SignTermDialog
          term={term}
          onClose={() => setOpen(false)}
          onSigned={(signed) => {
            setTerm(signed);
            notify('Termo assinado.');
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Termo de adesao na conta do proprio voluntario (Minha conta e Meu perfil): assinar, se falta, ou baixar a via
 * assinada.
 */
export function MyTermPanel({ volunteerId }: { volunteerId: string | null }) {
  const { notify, notifyError } = useToast();
  const [term, setTerm] = useMyTerm(Boolean(volunteerId));
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!term) return null;

  async function download() {
    setDownloading(true);
    try {
      await myTermApi.download();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível baixar o termo.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Termo de adesão</h2>
        {term.signed ? (
          <span className="badge badge--done">Assinado</span>
        ) : term.pending ? (
          <span className="badge badge--pause">Pendente</span>
        ) : null}
      </div>
      <div className="panel__body">
        {term.signed ? (
          <>
            <p className="field__hint docs__description">
              {signedLabel(term.signed)}.
              {term.signed.imageAuthorized === false ? ' Você não autorizou o uso da sua imagem.' : ''}
            </p>
            <Button small icon={<IconDownload size={15} />} loading={downloading} onClick={() => void download()}>
              Baixar PDF
            </Button>
          </>
        ) : (
          <>
            <p className="field__hint docs__description">
              Exigido pela Lei do Voluntariado (9.608/98), junto com a autorização de uso de imagem. Leia e assine aqui
              mesmo.
            </p>
            <Button small variant="primary" onClick={() => setOpen(true)}>
              Ler e assinar
            </Button>
          </>
        )}
      </div>

      {open ? (
        <SignTermDialog
          term={term}
          onClose={() => setOpen(false)}
          onSigned={(signed) => {
            setTerm(signed);
            notify('Termo assinado.');
          }}
        />
      ) : null}
    </section>
  );
}
