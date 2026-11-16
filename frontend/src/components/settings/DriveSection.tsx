import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { driveApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { DriveStatus } from '../../types/api';
import { formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, LoadError, Loading } from '../ui/Feedback';
import { IconFolder } from '../ui/Icons';

/** Enquanto a rotina tem o que fazer, a tela confere de tempos em tempos (pastas aparecendo, erros). */
const REFRESH_MS = 5000;

/**
 * Configuracoes › Google Drive (so administradores): ligar o nucleo a uma pasta de um Drive compartilhado. A
 * plataforma cria nela a pasta de cada programa e projeto (mao unica: o que se faz direto no Drive nao volta).
 */
export function DriveSection() {
  const { notify, notifyError } = useToast();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [changing, setChanging] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await driveApi.get());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a ligação com o Google Drive.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const waiting = (status?.pending ?? 0) > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [waiting, load]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setConnecting(true);
    setConnectError(null);
    try {
      setStatus(await driveApi.connect(link.trim()));
      setLink('');
      setChanging(false);
      notify('Google Drive ligado. As pastas dos projetos em aberto vão aparecer em instantes.');
    } catch (err) {
      setConnectError(err instanceof ApiError ? err.message : 'Não foi possível ligar o Google Drive.');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await driveApi.disconnect();
      setConfirmingOff(false);
      notify('Google Drive desligado. O que já estava no Drive continua lá.');
      await load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível desligar o Google Drive.');
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      setStatus(await driveApi.retry());
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível tentar de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      notify('E-mail copiado.');
    } catch {
      notifyError('Não foi possível copiar. Selecione o e-mail e copie à mão.');
    }
  }

  if (loadError && !status) return <LoadError message={loadError} onRetry={() => void load()} />;
  if (!status) return <Loading />;

  const connected = status.folderUrl !== null;

  const linkForm = (
    <form className="drive-link" onSubmit={(event) => void connect(event)}>
      <TextInput
        aria-label="Link da pasta no Google Drive"
        placeholder="https://drive.google.com/drive/folders/…"
        value={link}
        onChange={(event) => setLink(event.target.value)}
        disabled={!status.available}
      />
      <Button type="submit" variant="primary" loading={connecting} disabled={!status.available || link.trim() === ''}>
        Conectar
      </Button>
    </form>
  );

  return (
    <div className="spreadsheets">
      <section className="panel">
        <div className="panel__head">
          <h2>Google Drive</h2>
        </div>
        <div className="panel__body">
          {!status.available ? (
            <div className="mb-16">
              <Alert kind="warning">
                A ligação com o Google Drive ainda não foi configurada no servidor. Quem cuida da hospedagem precisa
                cadastrar a chave da conta da plataforma (variável GoogleDrive__ServiceAccountJson).
              </Alert>
            </div>
          ) : null}

          {connected && !changing ? (
            <>
              <div className="drive-connected">
                <IconFolder size={20} />
                <div className="drive-connected__text">
                  <a href={status.folderUrl!} target="_blank" rel="noreferrer">
                    {status.folderName}
                  </a>
                  <span className="text-muted">ligada em {formatDate(status.connectedAt)}</span>
                </div>
              </div>
              <p className="drive-numbers">
                {status.projectsWithFolder === 1 ? '1 projeto com pasta' : `${status.projectsWithFolder} projetos com pasta`}
                {status.pending > 0 ? ` · ${status.pending} aguardando` : ''}
                {status.failed > 0 ? ` · ${status.failed} com erro` : ''}
              </p>
              {status.lastError ? (
                <div className="mb-16">
                  <Alert kind="warning">
                    <div className="load-error">
                      <span>{status.lastError}</span>
                      <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void retry()}>
                        Tentar de novo
                      </button>
                    </div>
                  </Alert>
                </div>
              ) : null}
              <div className="row">
                <Button onClick={() => setChanging(true)}>Trocar pasta</Button>
                <Button variant="ghost" onClick={() => setConfirmingOff(true)}>
                  Desligar
                </Button>
              </div>
            </>
          ) : (
            <>
              {connectError ? (
                <div className="mb-16">
                  <Alert kind="error">{connectError}</Alert>
                </div>
              ) : null}
              <ol className="import-steps">
                <li>
                  <div>
                    <strong>Crie um Drive compartilhado do núcleo</strong> (ex.: "ESF Porto Alegre – Plataforma") e, dentro
                    dele, a pasta da plataforma. O que já existe no Drive pode continuar onde está.
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Adicione a conta da plataforma ao Drive compartilhado</strong>, com o acesso{' '}
                    <strong>Gerente de conteúdo</strong>:
                    {status.accountEmail ? (
                      <span className="drive-email">
                        <code>{status.accountEmail}</code>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void copyEmail(status.accountEmail!)}>
                          Copiar
                        </button>
                      </span>
                    ) : null}
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Cole o link da pasta e conecte.</strong> A plataforma confere se consegue criar pastas nela.
                  </div>
                  {linkForm}
                </li>
              </ol>
              {changing ? (
                <div className="mt-16">
                  <p className="spreadsheets__text">
                    Na pasta nova, a plataforma começa do zero. O que foi criado na pasta atual fica lá.
                  </p>
                  <Button variant="ghost" onClick={() => setChanging(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Como fica no Drive</h2>
        </div>
        <div className="panel__body">
          <p className="spreadsheets__text">
            Cada programa ganha uma pasta, e cada projeto em aberto, a sua, com as mesmas subpastas. Renomear ou mudar o
            projeto de programa acompanha no Drive. Funciona num sentido só: o que for feito direto no Drive não volta para
            a plataforma.
          </p>
          <pre className="drive-tree">{`Pasta da plataforma/
└── Programa/
    └── Projeto/
        ├── 01. Gestão/
        ├── 02. Projeto técnico/
        ├── 03. Orçamento e compras/
        ├── 04. Fotos e vídeos/
        │   └── Outras fotos/
        └── 05. Documentos/`}</pre>
          <p className="drive-note">
            Projetos concluídos e cancelados não ganham pasta ao ligar: o material deles continua onde já está. No projeto e
            no programa, o link "Pasta no Drive" abre a pasta para quem tem acesso ao Drive compartilhado.
          </p>
        </div>
      </section>

      {confirmingOff ? (
        <ConfirmDialog
          title="Desligar o Google Drive?"
          message="A plataforma para de criar pastas no Drive. O que já está lá continua no Drive."
          confirmLabel="Desligar"
          destructive
          busy={busy}
          onConfirm={() => void disconnect()}
          onCancel={() => setConfirmingOff(false)}
        />
      ) : null}
    </div>
  );
}
