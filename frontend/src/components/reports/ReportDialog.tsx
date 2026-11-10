import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { reportsApi } from '../../api/endpoints';
import { jobStatusText } from '../../api/jobs';
import { useToast } from '../../context/ToastContext';
import type { BackgroundJob } from '../../types/api';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { DEFAULT_REPORT_OPTIONS, ReportOptionsFields, reportOptionsError, reportPayload } from './ReportOptions';

interface ReportDialogProps {
  project: { id: string; name: string; imageAuthorizedOn: string | null };
  onClose: () => void;
}

/**
 * "Gerar relatorio" da pagina do projeto: as mesmas opcoes da tela Relatorios, so com este projeto. O PDF e montado
 * em segundo plano: a janela pode ser fechada e o download acontece do mesmo jeito.
 */
export function ReportDialog({ project, onClose }: ReportDialogProps) {
  const { notify, notifyError } = useToast();
  const [options, setOptions] = useState(DEFAULT_REPORT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<BackgroundJob | null>(null);
  const open = useRef(true);

  useEffect(
    () => () => {
      open.current = false;
    },
    []
  );

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const fileName = await reportsApi.generate(reportPayload([project.id], options), setProgress);
      notify(`Relatório gerado: ${fileName}`);
      if (open.current) onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível gerar o relatório.';
      // Janela ja fechada: o erro aparece no aviso.
      if (open.current) setError(message);
      else notifyError(message);
      setGenerating(false);
      setProgress(null);
    }
  }

  return (
    <Modal
      title="Gerar relatório"
      subtitle={project.name}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{generating ? 'Fechar' : 'Cancelar'}</Button>
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            loading={generating}
            disabled={Boolean(reportOptionsError(options))}
            onClick={() => void generate()}
          >
            Gerar PDF
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {progress ? (
        <div style={{ marginBottom: 14 }} aria-live="polite">
          <Alert kind="info">
            {jobStatusText(progress)} · pode fechar esta janela: o download começa sozinho quando o PDF ficar pronto.
          </Alert>
        </div>
      ) : null}
      <ReportOptionsFields
        value={options}
        onChange={setOptions}
        withoutImageAuthorization={!project.imageAuthorizedOn}
      />
    </Modal>
  );
}
