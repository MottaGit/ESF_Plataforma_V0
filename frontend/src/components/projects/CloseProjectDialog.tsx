import { useState } from 'react';
import { ApiError } from '../../api/client';
import { projectUpdatesApi, projectsApi } from '../../api/endpoints';
import type { ProjectDetail } from '../../types/api';
import { Button } from '../ui/Button';
import { Field, TextArea } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import { plainTextToHtml } from '../ui/RichText';

interface CloseProjectDialogProps {
  project: ProjectDetail;
  status: 'Concluido' | 'Cancelado';
  onCancel: () => void;
  /** Status gravado; recordError diz se o registro de encerramento nao foi publicado. */
  onClosed: (recordError: string | null) => void;
  /** "Ver tarefas": fecha a janela sem mudar nada e abre a aba Tarefas. */
  onOpenTasks: () => void;
}

/**
 * Confirmacao ao concluir ou cancelar um projeto: avisa das tarefas em aberto e pede, sem obrigar, um registro de
 * encerramento, publicado no Andamento (e por isso tambem no relatorio).
 */
export function CloseProjectDialog({ project, status, onCancel, onClosed, onOpenTasks }: CloseProjectDialogProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const concluding = status === 'Concluido';
  const open = project.activities.filter((activity) => activity.status !== 'Concluida');
  const late = open.filter((activity) => activity.isLate).length;
  const blocked = open.filter((activity) => activity.status === 'Bloqueada').length;
  const details = [
    late > 0 ? `${late} ${late === 1 ? 'atrasada' : 'atrasadas'}` : null,
    blocked > 0 ? `${blocked} ${blocked === 1 ? 'bloqueada' : 'bloqueadas'}` : null
  ].filter(Boolean);

  async function confirm() {
    const text = note.trim();
    if (text.length > 0 && text.length < 3) {
      setError('O registro precisa ter pelo menos 3 caracteres.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await projectsApi.updateStatus(project.id, status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar o status.');
      setBusy(false);
      return;
    }

    // O status ja mudou: se o registro falhar, a pagina avisa e ele pode ser publicado pelo Andamento.
    let recordError: string | null = null;
    if (text) {
      try {
        await projectUpdatesApi.create(project.id, plainTextToHtml(text), []);
      } catch (err) {
        recordError = err instanceof ApiError ? err.message : 'Não foi possível publicar o registro de encerramento.';
      }
    }
    onClosed(recordError);
  }

  return (
    <Modal
      title={concluding ? 'Concluir projeto' : 'Cancelar projeto'}
      subtitle={project.name}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Voltar</Button>
          <Button variant={concluding ? 'primary' : 'danger'} loading={busy} onClick={() => void confirm()}>
            {concluding ? 'Concluir projeto' : 'Cancelar projeto'}
          </Button>
        </>
      }
    >
      <div className="close-project">
        {error ? <Alert kind="error">{error}</Alert> : null}

        <p className="close-project__intro">
          {concluding
            ? 'O projeto passa para concluído e conta como 100% de progresso.'
            : 'O projeto passa para cancelado. Tarefas, registros e arquivos continuam guardados.'}{' '}
          Dá para reabrir depois, mudando o status de novo.
        </p>

        {open.length > 0 ? (
          <Alert kind="warning">
            <div className="close-project__open">
              <span>
                {open.length === 1 ? 'Ainda há 1 tarefa em aberto' : `Ainda há ${open.length} tarefas em aberto`}
                {details.length > 0 ? ` (${details.join(', ')})` : ''}.{' '}
                {open.length === 1 ? 'Ela continua como está.' : 'Elas continuam como estão.'}
                {concluding ? ' Conclua antes o que já foi feito, para o relatório mostrar o que foi entregue.' : ''}
              </span>
              <Button small onClick={onOpenTasks}>
                Ver tarefas
              </Button>
            </div>
          </Alert>
        ) : null}

        <Field
          label={concluding ? 'Registro de encerramento' : 'Motivo do cancelamento'}
          htmlFor="close-project-note"
          hint="Opcional. É publicado no Andamento do projeto e entra no relatório."
        >
          <TextArea
            id="close-project-note"
            rows={4}
            value={note}
            placeholder={
              concluding ? 'O que foi entregue, para quem e quando.' : 'Ex.: a família mudou de endereço antes da obra.'
            }
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
