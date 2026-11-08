import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Program, ProgramPublicPage } from '../../types/api';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, Loading } from '../ui/Feedback';
import { IconGlobe, IconWhatsApp } from '../ui/Icons';
import { Modal } from '../ui/Modal';

const ABOUT_MAX = 1500;

interface PublicPageDialogProps {
  program: Program;
  onClose: () => void;
  /** A pagina foi ligada ou desligada (a visao do programa mostra a situacao). */
  onChanged: () => void;
}

/**
 * Pagina publica do programa (coordenacao): ligar/desligar, o texto "Sobre o programa" e o link para mandar. Salvar
 * nao fecha a janela, para o link aparecer logo depois de ligar.
 */
export function PublicPageDialog({ program, onClose, onChanged }: PublicPageDialogProps) {
  const { notify, notifyError } = useToast();
  const [saved, setSaved] = useState<ProgramPublicPage | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    programsApi
      .publicPage(program.id)
      .then((page) => {
        setSaved(page);
        setEnabled(page.enabled);
        setDescription(page.description ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a página pública.'));
  }, [program.id]);

  const url = saved?.token ? `${window.location.origin}/publico/${saved.token}` : null;
  const message = url ? `Acompanhe o programa ${program.name}, do Engenheiros Sem Fronteiras: ${url}` : '';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const page = await programsApi.savePublicPage(program.id, {
        enabled,
        description: description.trim() === '' ? null : description.trim()
      });
      const toggled = page.enabled !== saved?.enabled;
      setSaved(page);
      setDescription(page.description ?? '');
      notify(toggled ? (page.enabled ? 'Página pública ligada. Copie o link abaixo.' : 'Página pública desligada.') : 'Página pública salva.');
      if (toggled) onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a página pública.');
    } finally {
      setSaving(false);
    }
  }

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
      guardChanges
      guardResetKey={saved}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Fechar</Button>
          <Button variant="primary" loading={saving} disabled={!saved} onClick={() => void save()}>
            Salvar
          </Button>
        </>
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

          <label className="checkbox public-page-dialog__toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Página pública ligada
          </label>

          {saved.enabled && !enabled ? (
            <Alert kind="warning">Ao salvar, o link atual deixa de abrir. Ligar de novo gera um link novo.</Alert>
          ) : null}

          {url && enabled ? (
            <div className="access-link">
              <TextInput value={url} readOnly aria-label="Link da página pública" onFocus={(event) => event.target.select()} />
              <div className="access-link__actions">
                <Button variant="primary" onClick={() => void copy()}>
                  Copiar link
                </Button>
                <a
                  className="btn"
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconWhatsApp size={15} />
                  Enviar pelo WhatsApp
                </a>
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
            hint={`Aparece no topo da página. Escreva para quem não conhece o núcleo: o que o programa faz, para quem e onde. ${description.length}/${ABOUT_MAX}`}
          >
            <TextArea
              id="public-about"
              rows={5}
              maxLength={ABOUT_MAX}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
