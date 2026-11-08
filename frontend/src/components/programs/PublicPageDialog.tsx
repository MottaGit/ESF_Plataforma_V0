import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Program, ProgramPublicPage } from '../../types/api';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, Loading } from '../ui/Feedback';
import { IconGlobe } from '../ui/Icons';
import { Modal } from '../ui/Modal';

const ABOUT_MAX = 1500;

interface PublicPageDialogProps {
  program: Program;
  onClose: () => void;
  /** O link foi gerado ou desligado (a visao do programa mostra a situacao). */
  onChanged: () => void;
}

/**
 * Pagina publica do programa (coordenacao). Sem link: "Gerar link" liga a pagina na hora. Com link: copiar, ver como o
 * publico ve e "Desligar link". O "Sobre o programa" e salvo sozinho ao sair do campo.
 */
export function PublicPageDialog({ program, onClose, onChanged }: PublicPageDialogProps) {
  const { notify, notifyError } = useToast();
  const [saved, setSaved] = useState<ProgramPublicPage | null>(null);
  const [description, setDescription] = useState('');
  const [working, setWorking] = useState<'generate' | 'disable' | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // As gravacoes vao uma de cada vez, na ordem: sair do campo de texto e clicar em "Gerar link" logo depois manda
  // as duas, e a segunda precisa chegar por ultimo.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const savedRef = useRef<ProgramPublicPage | null>(null);

  useEffect(() => {
    programsApi
      .publicPage(program.id)
      .then((page) => {
        savedRef.current = page;
        setSaved(page);
        setDescription(page.description ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a página pública.'));
  }, [program.id]);

  function persist(enabled: boolean, text: string, success: string) {
    const run = async () => {
      setError(null);
      try {
        const page = await programsApi.savePublicPage(program.id, {
          enabled,
          description: text.trim() === '' ? null : text.trim()
        });
        const toggled = page.enabled !== savedRef.current?.enabled;
        savedRef.current = page;
        setSaved(page);
        notify(success);
        if (toggled) onChanged();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a página pública.');
      }
    };
    const next = queue.current.then(run);
    queue.current = next.catch(() => undefined);
    return next;
  }

  function saveTextIfChanged() {
    const current = savedRef.current;
    if (!current || description.trim() === (current.description ?? '')) return;
    void persist(current.enabled, description, 'Texto da página salvo.');
  }

  async function generate() {
    setWorking('generate');
    await persist(true, description, 'Link gerado. Copie e mande para quem vai acompanhar o programa.');
    setWorking(null);
  }

  async function disable() {
    setConfirmingDisable(false);
    setWorking('disable');
    await persist(false, description, 'Link desligado: ele não abre mais.');
    setWorking(null);
  }

  const url = saved?.enabled && saved.token ? `${window.location.origin}/publico/${saved.token}` : null;

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
              data-carries-text
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
              data-carries-text
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

          <Field
            label="Sobre o programa"
            htmlFor="public-about"
            hint={`Aparece no topo da página; é salvo ao sair do campo. Escreva para quem não conhece o núcleo: o que o programa faz, para quem e onde. ${description.length}/${ABOUT_MAX}`}
          >
            <TextArea
              id="public-about"
              rows={5}
              maxLength={ABOUT_MAX}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              // Clicar em "Gerar link" ou "Desligar link" ja leva o texto junto: nao grava duas vezes.
              onBlur={(event) => {
                if (!(event.relatedTarget instanceof HTMLElement && event.relatedTarget.dataset.carriesText !== undefined))
                  saveTextIfChanged();
              }}
            />
          </Field>
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
