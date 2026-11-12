import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../api/client';
import { spreadsheetsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ImportResult } from '../../types/api';
import { RecentJobs } from '../jobs/RecentJobs';
import { ExportSpreadsheetDialog } from '../spreadsheets/ExportSpreadsheetDialog';
import { ImportReviewDialog } from '../spreadsheets/ImportReviewDialog';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { IconDownload, IconUpload } from '../ui/Icons';

/**
 * Configuracoes › Planilhas (so administradores): exportar projetos e voluntarios e importar uma planilha preenchida
 * (modelo vazio ou exportacao completada), sempre passando pela conferencia antes de gravar.
 */
export function SpreadsheetsSection() {
  const { notify, notifyError } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ file: File; preview: ImportResult } | null>(null);
  const [recentKey, setRecentKey] = useState(0);

  async function downloadTemplate() {
    setDownloading(true);
    try {
      notify(`Modelo baixado: ${await spreadsheetsApi.template()}`);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível baixar o modelo.');
    } finally {
      setDownloading(false);
    }
  }

  async function check(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setChecking(true);
    setError(null);
    try {
      setReview({ file, preview: await spreadsheetsApi.import(file, false) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="spreadsheets">
      <div className="spreadsheets__stack">
        <section className="panel">
          <div className="panel__head">
            <h2>Exportar planilha</h2>
          </div>
          <div className="panel__body">
            <p className="spreadsheets__text">
              Projetos e voluntários do núcleo num arquivo do Excel, para guardar, conferir ou completar e importar de volta.
              Você escolhe o que entra.
            </p>
            <Button icon={<IconDownload size={15} />} onClick={() => setExporting(true)}>
              Exportar planilha
            </Button>
          </div>
        </section>

        <RecentJobs kinds={['SpreadsheetExport']} title="Exportadas recentemente" fallbackName="Planilha" refreshKey={recentKey} />
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2>Importar planilha</h2>
        </div>
        <div className="panel__body">
          {error ? (
            <div className="mb-16">
              <Alert kind="error">{error}</Alert>
            </div>
          ) : null}
          <ol className="import-steps">
            <li>
              <div>
                <strong>Baixe o modelo vazio.</strong> Ele já traz nas listas os programas, as pessoas e os indicadores do
                núcleo.
              </div>
              <Button small icon={<IconDownload size={15} />} loading={downloading} onClick={() => void downloadTemplate()}>
                Baixar modelo
              </Button>
            </li>
            <li>
              <div>
                <strong>Preencha à mão ou com a ajuda de uma IA.</strong> A aba Instruções explica cada coluna, com regras e um
                exemplo; dá para entregar o modelo e as anotações soltas a uma IA. Uma exportação completada também serve.
              </div>
            </li>
            <li>
              <div>
                <strong>Envie o arquivo.</strong> Antes de gravar, aparece a conferência: o que é novo, o que já existe e os
                erros de cada linha. A importação só cria; o que já está na plataforma não muda.
              </div>
              <Button
                small
                variant="primary"
                icon={<IconUpload size={15} />}
                loading={checking}
                onClick={() => fileInput.current?.click()}
              >
                Enviar planilha
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(event) => void check(event)}
              />
            </li>
          </ol>
        </div>
      </section>

      {exporting ? (
        <ExportSpreadsheetDialog
          onClose={() => {
            setExporting(false);
            setRecentKey((current) => current + 1);
          }}
        />
      ) : null}
      {review ? <ImportReviewDialog file={review.file} preview={review.preview} onClose={() => setReview(null)} /> : null}
    </div>
  );
}
