import { useState } from 'react';
import { ApiError } from '../../api/client';
import { reportsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { DEFAULT_REPORT_OPTIONS, ReportOptionsFields, reportOptionsError, reportPayload } from './ReportOptions';

interface ReportDialogProps {
  project: { id: string; name: string; imageAuthorizedOn: string | null };
  onClose: () => void;
}

/** "Gerar relatorio" da pagina do projeto: as mesmas opcoes da tela Relatorios, so com este projeto. */
export function ReportDialog({ project, onClose }: ReportDialogProps) {
  const { notify } = useToast();
  const [options, setOptions] = useState(DEFAULT_REPORT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const fileName = await reportsApi.generate(reportPayload([project.id], options));
      notify(`Relatório gerado: ${fileName}`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o relatório.');
      setGenerating(false);
    }
  }

  return (
    <Modal
      title="Gerar relatório"
      subtitle={project.name}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
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
      <ReportOptionsFields
        value={options}
        onChange={setOptions}
        withoutImageAuthorization={!project.imageAuthorizedOn}
      />
    </Modal>
  );
}
