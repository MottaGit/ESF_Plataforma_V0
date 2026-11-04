import { useState } from 'react';
import { ApiError } from '../../api/client';
import { spreadsheetsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ExportSpreadsheetPayload } from '../../types/api';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';
import { Modal } from '../ui/Modal';

const OPTIONS: Array<{ key: keyof ExportSpreadsheetPayload; label: string; description: string }> = [
  {
    key: 'projects',
    label: 'Projetos',
    description: 'Um por linha, com situação, datas, indicadores, equipe e local. Vem junto o resumo dos programas.'
  },
  {
    key: 'volunteers',
    label: 'Voluntários',
    description: 'Contatos, setor, situação, entrada e saída, termo de adesão, horas de voluntariado e acesso.'
  }
];

interface ExportSpreadsheetDialogProps {
  /** O que ja vem marcado (o atalho de Projetos marca so projetos, por exemplo). Sem nada: tudo. */
  initial?: Partial<ExportSpreadsheetPayload>;
  onClose: () => void;
}

/** "Exportar planilha": escolhe o que entra no arquivo (.xlsx) e baixa. */
export function ExportSpreadsheetDialog({ initial, onClose }: ExportSpreadsheetDialogProps) {
  const { notify } = useToast();
  const [choice, setChoice] = useState<ExportSpreadsheetPayload>({
    projects: initial?.projects ?? true,
    volunteers: initial?.volunteers ?? true
  });
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function download() {
    setExporting(true);
    setError(null);
    try {
      const fileName = await spreadsheetsApi.export(choice);
      notify(`Planilha baixada: ${fileName}`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a planilha.');
      setExporting(false);
    }
  }

  return (
    <Modal
      title="Exportar planilha"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            loading={exporting}
            disabled={!choice.projects && !choice.volunteers}
            onClick={() => void download()}
          >
            Baixar planilha
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <p className="export-options__intro">O que vai no arquivo do Excel:</p>
      <div className="export-options">
        {OPTIONS.map((option) => (
          <label key={option.key} className="export-option">
            <input
              type="checkbox"
              checked={choice[option.key]}
              onChange={(event) => setChoice({ ...choice, [option.key]: event.target.checked })}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
      {choice.volunteers ? (
        <p className="export-options__note">
          A planilha de voluntários tem dados pessoais: guarde em local restrito. A exportação fica no histórico de
          alterações.
        </p>
      ) : null}
    </Modal>
  );
}
