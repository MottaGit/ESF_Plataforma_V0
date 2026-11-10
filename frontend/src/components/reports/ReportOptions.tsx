import type { ReportFormat, ReportPayload } from '../../types/api';
import { periodShortcuts, type PeriodShortcut } from '../../utils/periods';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';

/** O que a pessoa escolhe sobre o conteudo do PDF (os projetos vem de quem abriu as opcoes). */
export interface ReportOptions {
  /** Periodo de referencia (aaaa-mm-dd); vazio nas duas pontas, todo o historico. */
  from: string;
  to: string;
  includeTasks: boolean;
  includePhotos: boolean;
  note: string;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  from: '',
  to: '',
  includeTasks: true,
  includePhotos: true,
  note: ''
};

/** Problema nas opcoes que impede gerar o PDF (null: pode gerar). */
export function reportOptionsError(options: Pick<ReportOptions, 'from' | 'to'>) {
  return options.from && options.to && options.to < options.from
    ? 'O fim do período não pode ser antes do início.'
    : null;
}

/** Pedido do PDF: indicadores, voluntarios e linha do tempo sempre entram (no Completo). */
export function reportPayload(
  projectIds: string[],
  options: ReportOptions,
  format: ReportFormat = 'Completo'
): ReportPayload {
  return {
    projectIds,
    format,
    includeVolunteers: true,
    includeIndicators: true,
    includeUpdates: true,
    includePhotos: options.includePhotos,
    includeTasks: options.includeTasks,
    from: options.from || null,
    to: options.to || null,
    note: options.note.trim() || null
  };
}

interface ReportPeriodFieldProps {
  from: string;
  to: string;
  /** Atalho escolhido (a tela Relatorios guarda o nome dele na URL). */
  onShortcut: (shortcut: PeriodShortcut) => void;
  /** Datas digitadas. */
  onDates: (from: string, to: string) => void;
}

/** Periodo de referencia: atalhos de prestacao de contas e as duas datas. */
export function ReportPeriodField({ from, to, onShortcut, onDates }: ReportPeriodFieldProps) {
  const periodError = reportOptionsError({ from, to });

  return (
    <div className="field">
      <label className="field__label" htmlFor="report-from">
        Período de referência
      </label>
      <div className="chip-group report-period__shortcuts" role="group" aria-label="Atalhos de período">
        {periodShortcuts().map((shortcut) => {
          const active = from === shortcut.from && to === shortcut.to;
          return (
            <button
              key={shortcut.key}
              type="button"
              className={`chip${active ? ' chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => onShortcut(shortcut)}
            >
              {shortcut.label}
            </button>
          );
        })}
      </div>
      <div className="report-period">
        <TextInput
          id="report-from"
          type="date"
          aria-label="Início do período"
          value={from}
          invalid={Boolean(periodError)}
          onChange={(event) => onDates(event.target.value, to)}
        />
        <span className="report-period__sep">a</span>
        <TextInput
          type="date"
          aria-label="Fim do período"
          value={to}
          invalid={Boolean(periodError)}
          onChange={(event) => onDates(from, event.target.value)}
        />
      </div>
      {periodError ? (
        <span className="field__error">{periodError}</span>
      ) : (
        <span className="field__hint">
          Filtra os registros (com as fotos) e as tarefas concluídas. Indicadores e equipe saem como estão hoje.
        </span>
      )}
    </div>
  );
}

interface ReportExtrasProps {
  value: ReportOptions;
  onChange: (value: ReportOptions) => void;
}

/** O que mais entra no capitulo de cada projeto (formato Completo). */
export function ReportExtrasField({ value, onChange }: ReportExtrasProps) {
  return (
    <div className="report-options__checks">
      <span className="field__hint">Indicadores, equipe e linha do tempo sempre entram. Também incluir:</span>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.includeTasks}
          onChange={(event) => onChange({ ...value, includeTasks: event.target.checked })}
        />
        Tarefas concluídas
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.includePhotos}
          onChange={(event) => onChange({ ...value, includePhotos: event.target.checked })}
        />
        Registro fotográfico
      </label>
    </div>
  );
}

/** Observacao livre impressa no inicio do PDF. */
export function ReportNoteField({ value, onChange }: ReportExtrasProps) {
  return (
    <Field label="Observação do relatório" htmlFor="report-note" hint="Aparece no início do documento. Ex.: finalidade ou parceiro.">
      <TextArea id="report-note" value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} />
    </Field>
  );
}

interface ReportOptionsFieldsProps extends ReportExtrasProps {
  /** Projeto sem autorizacao de uso de imagem dos beneficiarios: so um aviso, o PDF nao muda. */
  withoutImageAuthorization: boolean;
}

/** "Gerar relatorio" da pagina do projeto: periodo, o que mais entra e a observacao (sempre o formato Completo). */
export function ReportOptionsFields({ value, onChange, withoutImageAuthorization }: ReportOptionsFieldsProps) {
  return (
    <div className="report-options">
      <ReportPeriodField
        from={value.from}
        to={value.to}
        onShortcut={(shortcut) => onChange({ ...value, from: shortcut.from, to: shortcut.to })}
        onDates={(from, to) => onChange({ ...value, from, to })}
      />
      <ReportExtrasField value={value} onChange={onChange} />
      {value.includePhotos && withoutImageAuthorization ? (
        <Alert kind="warning">
          Este projeto não tem autorização de uso de imagem dos beneficiários registrada. As fotos entram no relatório;
          confira se podem ser usadas.
        </Alert>
      ) : null}
      <ReportNoteField value={value} onChange={onChange} />
    </div>
  );
}
