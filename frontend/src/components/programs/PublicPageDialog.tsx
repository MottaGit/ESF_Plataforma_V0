import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Program, ProgramPublicPage } from '../../types/api';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, Loading } from '../ui/Feedback';
import { IconGlobe } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface PublicPageDialogProps {
  program: Program;
  onClose: () => void;
  /** O link foi gerado ou desligado (a visao do programa mostra a situacao). */
  onChanged: () => void;
}

/**
 * Pagina publica do programa (coordenacao). Sem link: "Gerar link" liga a pagina na hora. Com link: copiar, ver como o
 * publico ve e "Desligar link". O texto do topo e o "Sobre o programa", editado em Editar programa › Sobre.
 */
export function PublicPageDialog({ program, onClose, onChanged }: PublicPageDialogProps) {
  const { notify, notifyError } = useToast();
  const [saved, setSaved] = useState<ProgramPublicPage | null>(null);
  const [working, setWorking] = useState<'generate' | 'disable' | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    programsApi
      .publicPage(program.id)
      .then(setSaved)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a página pública.'));
  }, [program.id]);

  async function persist(enabled: boolean, success: string) {
    setError(null);
    try {
      setSaved(await programsApi.savePublicPage(program.id, { enabled }));
      notify(success);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a página pública.');
    }
  }

  async function generate() {
    setWorking('generate');
    await persist(true, 'Link gerado. Copie e mande para quem vai acompanhar o programa.');
    setWorking(null);
  }

  async function disable() {
    setConfirmingDisable(false);
    setWorking('disable');
    await persist(false, 'Link desligado: ele não abre mais.');
    setWorking(null);
  }

  const url = saved?.enabled && saved.token ? `${window.location.origin}/publico/${saved.token}` : null;
  const editAbout = `/programas/${program.id}/editar`;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copiado.');
    } catch {
      notifyError('Não foi possível copiar. Selecione o link e copie à mão.');
    }
  }

  return (
    <Modal
      title="Página pública"
      subtitle={program.name}
      onClose={onClose}
      footer={
        url ? (
          <>
            <Button
              key="disable"
              variant="ghost"
              className="public-page-dialog__disable"
              loading={working === 'disable'}
              onClick={() => setConfirmingDisable(true)}
            >
              Desligar link
            </Button>
            <Button key="close" onClick={onClose}>
              Fechar
            </Button>
          </>
        ) : (
          <>
            <Button key="close" onClick={onClose}>
              Fechar
            </Button>
            <Button
              key="generate"
              variant="primary"
              loading={working === 'generate'}
              disabled={!saved}
              onClick={() => void generate()}
            >
              Gerar link
            </Button>
          </>
        )
      }
    >
      {error ? (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}

      {!saved ? (
        error ? null : <Loading />
      ) : (
        <div className="public-page-dialog">
          <p className="field__hint">
            Um link que abre sem login, só para leitura, para mandar a parceiros e financiadores. Mostra o nome, a situação,
            o bairro e a cidade, o período, o progresso e os indicadores de cada projeto (menos cancelados e arquivados),
            os resultados somados, quantos voluntários e horas, e o CNPJ e o e-mail do núcleo. Nunca mostra endereço,
            pessoas, tarefas, registros, fotos ou arquivos.
          </p>

          {url ? (
            <div className="access-link">
              <TextInput value={url} readOnly aria-label="Link da página pública" onFocus={(event) => event.target.select()} />
              <div className="access-link__actions">
                <Button variant="primary" onClick={() => void copy()}>
                  Copiar link
                </Button>
                <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
                  <IconGlobe size={15} />
                  Ver como o público vê
                </a>
              </div>
            </div>
          ) : null}

          <div className="public-page-dialog__about">
            <div className="meta__label">Sobre o programa (topo da página)</div>
            {program.about ? (
              <p className="public-page-dialog__about-text">{program.about}</p>
            ) : (
              <p className="field__hint">
                Ainda sem texto. Escreva para quem não conhece o núcleo: o que o programa faz, para quem e onde.
              </p>
            )}
            <Link to={editAbout} className="public-page-dialog__about-link">
              {program.about ? 'Editar o texto' : 'Escrever o texto'} em Editar programa › Sobre
            </Link>
          </div>
        </div>
      )}

      {confirmingDisable ? (
        <ConfirmDialog
          title="Desligar o link?"
          message="Quem recebeu o link não consegue mais abrir a página. Se gerar de novo, o link será outro."
          confirmLabel="Desligar link"
          destructive
          onCancel={() => setConfirmingDisable(false)}
          onConfirm={() => void disable()}
        />
      ) : null}
    </Modal>
  );
}
