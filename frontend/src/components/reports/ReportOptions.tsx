import type { ReportFormat, ReportPayload } from '../../types/api';
import { todayInputValue } from '../../utils/format';
import { defaultPeriod, type PeriodShortcut } from '../../utils/periods';
import { Field, TextArea } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { PeriodPicker } from '../ui/PeriodPicker';

/** O que a pessoa escolhe sobre o conteudo do PDF (os projetos vem de quem abriu as opcoes). */
export interface ReportOptions {
  /** Periodo de referencia (aaaa-mm-dd). */
  from: string;
  to: string;
  includeTasks: boolean;
  includePhotos: boolean;
  note: string;
}

/** Opcoes de quem acabou de abrir: o periodo padrao (ultimos 30 dias), com tarefas e fotos. */
export function defaultReportOptions(): ReportOptions {
  const period = defaultPeriod();
  return { from: period.from, to: period.to, includeTasks: true, includePhotos: true, note: '' };
}

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
  /** Personalizado "sem data final" (a tela Relatorios sabe pela URL). */
  openEnded?: boolean;
  /** Atalho escolhido (a tela Relatorios guarda o nome dele na URL). */
  onShortcut: (shortcut: PeriodShortcut) => void;
  /** Personalizado; to null: sem data final (ate hoje). */
  onCustom: (from: string, to: string | null) => void;
}

/** Periodo de referencia: o calendario com os atalhos (ultimos 30 dias, 3, 6 e 12 meses) e o personalizado. */
export function ReportPeriodField({ from, to, openEnded, onShortcut, onCustom }: ReportPeriodFieldProps) {
  const periodError = reportOptionsError({ from, to });

  return (
    <div className="field">
      <span className="field__label">Período de referência</span>
      <PeriodPicker
        label="Período de referência"
        from={from}
        to={to}
        openEnded={openEnded}
        onShortcut={onShortcut}
        onCustom={onCustom}
      />
      {periodError ? (
        <span className="field__error">{periodError}</span>
      ) : (
        <span className="field__hint">
          Filtra os registros (com as fotos), as tarefas concluídas e as horas. Os indicadores saem como estavam no fim
          do período, com quanto mudaram nele; a equipe sai como está hoje.
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
        Tarefas concluídas e próximas etapas
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
        onCustom={(from, to) => onChange({ ...value, from, to: to ?? todayInputValue() })}
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
