import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { spreadsheetsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ImportResult, ImportRow, ImportSheet } from '../../types/api';
import { Button } from '../ui/Button';
import { Alert, EmptyState } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const RESULT_BADGE: Record<ImportRow['result'], { label: string; className: string }> = {
  New: { label: 'Novo', className: 'badge--run' },
  Existing: { label: 'Já existe', className: 'badge--neutral' },
  Error: { label: 'Erro', className: 'badge--late' }
};

const hasProblem = (row: ImportRow) => row.errors.length > 0 || row.warnings.length > 0;

/** "Entraram 2 projetos e 1 voluntário. 1 linha com erro ficou de fora." */
function importSummary(result: ImportResult) {
  const newProjects = result.projects?.new ?? 0;
  const newVolunteers = result.volunteers?.new ?? 0;
  const errors = (result.projects?.errors ?? 0) + (result.volunteers?.errors ?? 0);
  const created = [
    newProjects > 0 ? plural(newProjects, 'projeto', 'projetos') : null,
    result.newPrograms.length > 0 ? plural(result.newPrograms.length, 'programa novo', 'programas novos') : null,
    newVolunteers > 0 ? plural(newVolunteers, 'voluntário', 'voluntários') : null
  ].filter(Boolean);
  return (
    (created.length > 0 ? `Entraram ${created.join(', ').replace(/, ([^,]*)$/, ' e $1')}.` : 'Nada novo entrou.') +
    (errors > 0 ? ` ${plural(errors, 'linha com erro ficou', 'linhas com erro ficaram')} de fora.` : '')
  );
}

/** "3 novos · 1 já existe · 2 com erro" (so o que tem). */
function sheetSummary(sheet: ImportSheet) {
  const parts = [
    sheet.new > 0 ? plural(sheet.new, 'novo', 'novos') : null,
    sheet.existing > 0 ? `${sheet.existing} já ${sheet.existing === 1 ? 'existe' : 'existem'}` : null,
    sheet.errors > 0 ? `${sheet.errors} com erro` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'nenhuma linha preenchida';
}

function RowsTable({ title, column, rows }: { title: string; column: string; rows: ImportRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="import-sheet">
      <h3 className="import-sheet__title">{title}</h3>
      <div>
        <table className="table table--cards import-table">
          <thead>
            <tr>
              <th>Linha</th>
              <th>{column}</th>
              <th>Resultado</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row}>
                <td className="tight num import-table__line" data-label="Linha">
                  {row.row}
                </td>
                <td className="cell--main">
                  <div className="table__primary">{row.label}</div>
                  {row.detail ? <div className="table__secondary">{row.detail}</div> : null}
                </td>
                <td>
                  <span className={`badge ${RESULT_BADGE[row.result].className}`}>{RESULT_BADGE[row.result].label}</span>
                </td>
                <td className="cell--wide">
                  {row.errors.map((message) => (
                    <div key={message} className="import-message import-message--error">
                      {message}
                    </div>
                  ))}
                  {row.warnings.map((message) => (
                    <div key={message} className="import-message import-message--warning">
                      {message}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ImportReviewDialogProps {
  file: File;
  /** Conferencia que a API devolveu para o arquivo (nada gravado ainda). */
  preview: ImportResult;
  onClose: () => void;
}

/**
 * Conferencia da importacao: o que e novo, o que ja existe e os erros de cada linha, antes de gravar. Ao confirmar, o
 * arquivo vai de novo para a API (que confere outra vez e cria o que e novo e sem erro).
 */
export function ImportReviewDialog({ file, preview, onClose }: ImportReviewDialogProps) {
  const { notify, notifyError } = useToast();
  const [result, setResult] = useState(preview);
  const open = useRef(true);

  useEffect(
    () => () => {
      open.current = false;
    },
    []
  );
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newProjects = result.projects?.new ?? 0;
  const newVolunteers = result.volunteers?.new ?? 0;
  const errors = (result.projects?.errors ?? 0) + (result.volunteers?.errors ?? 0);
  const allRows = [...(result.projects?.rows ?? []), ...(result.volunteers?.rows ?? [])];
  const problems = allRows.filter(hasProblem).length;
  const shown = (rows: ImportRow[] | undefined) => (rows ?? []).filter((row) => !onlyProblems || hasProblem(row));

  async function confirm() {
    setImporting(true);
    setError(null);
    try {
      // Em segundo plano: se a janela for fechada no meio, a importação termina do mesmo jeito e o resumo vem no aviso.
      const applied = await spreadsheetsApi.import(file, true);
      if (open.current) setResult(applied);
      else notify(`Importação concluída: ${importSummary(applied)}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível importar a planilha.';
      if (open.current) setError(message);
      else notifyError(message);
    } finally {
      if (open.current) setImporting(false);
    }
  }

  if (result.applied) {
    return (
      <Modal title="Importação concluída" subtitle={file.name} size="narrow" onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
        <p className="import-done">
          {importSummary(result)}
        </p>
        <div className="import-done__links">
          {newProjects > 0 ? (
            <Link className="btn" to="/projetos" onClick={onClose}>
              Ver projetos
            </Link>
          ) : null}
          {newVolunteers > 0 ? (
            <Link className="btn" to="/voluntarios" onClick={onClose}>
              Ver voluntários
            </Link>
          ) : null}
        </div>
      </Modal>
    );
  }

  const toImport = [
    newProjects > 0 ? plural(newProjects, 'projeto', 'projetos') : null,
    newVolunteers > 0 ? plural(newVolunteers, 'voluntário', 'voluntários') : null
  ].filter(Boolean);

  return (
    <Modal
      title="Conferência da importação"
      subtitle={file.name}
      size="wide"
      onClose={onClose}
      footer={
        <>
          {errors > 0 ? (
            <span className="modal__foot-note">Linhas com erro ficam de fora: corrija na planilha e envie de novo.</span>
          ) : null}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={importing} disabled={toImport.length === 0} onClick={() => void confirm()}>
            {toImport.length > 0 ? `Importar ${toImport.join(' e ')}` : 'Nada novo para importar'}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-16">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {result.fileWarnings.length > 0 ? (
        <div className="mb-16">
          <Alert kind="warning">
            {result.fileWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </Alert>
        </div>
      ) : null}

      <dl className="import-summary">
        {result.projects ? (
          <div>
            <dt>Projetos</dt>
            <dd>{sheetSummary(result.projects)}</dd>
          </div>
        ) : null}
        {result.newPrograms.length > 0 ? (
          <div>
            <dt>Programas novos</dt>
            <dd>
              {result.newPrograms.map((program) => `${program.name}${program.archived ? ' (arquivado)' : ''}`).join(' · ')}
            </dd>
          </div>
        ) : null}
        {result.volunteers ? (
          <div>
            <dt>Voluntários</dt>
            <dd>{sheetSummary(result.volunteers)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="import-note">A importação só cria: o que já está na plataforma é ignorado, nunca alterado.</p>

      {allRows.length === 0 ? (
        <EmptyState title="A planilha não tem linhas preenchidas" description="Preencha as abas Projetos e Voluntários e envie de novo." />
      ) : (
        <>
          {problems > 0 ? (
            <div className="segmented import-filter" role="group" aria-label="Linhas">
              <button
                type="button"
                className={`segmented__option${onlyProblems ? '' : ' segmented__option--active'}`}
                aria-pressed={!onlyProblems}
                onClick={() => setOnlyProblems(false)}
              >
                Todas as linhas
              </button>
              <button
                type="button"
                className={`segmented__option${onlyProblems ? ' segmented__option--active' : ''}`}
                aria-pressed={onlyProblems}
                onClick={() => setOnlyProblems(true)}
              >
                Erros e avisos ({problems})
              </button>
            </div>
          ) : null}
          <div className="import-rows">
            <RowsTable title="Aba Projetos" column="Projeto" rows={shown(result.projects?.rows)} />
            <RowsTable title="Aba Voluntários" column="Pessoa" rows={shown(result.volunteers?.rows)} />
          </div>
        </>
      )}
    </Modal>
  );
}
