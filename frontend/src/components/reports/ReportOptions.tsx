import type { ReportPayload } from '../../types/api';
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
export function reportOptionsError(options: ReportOptions) {
  return options.from && options.to && options.to < options.from
    ? 'O fim do período não pode ser antes do início.'
    : null;
}

/** Pedido do PDF: indicadores, voluntarios e linha do tempo sempre entram. */
export function reportPayload(projectIds: string[], options: ReportOptions): ReportPayload {
  return {
    projectIds,
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

interface ReportOptionsFieldsProps {
  value: ReportOptions;
  onChange: (value: ReportOptions) => void;
  /** Projetos escolhidos sem autorizacao de uso de imagem dos beneficiarios: so um aviso, o PDF nao muda. */
  withoutImageAuthorization: string[];
}

/** Conteudo do PDF: os mesmos campos na tela Relatorios e no "Gerar relatorio" da pagina do projeto. */
export function ReportOptionsFields({ value, onChange, withoutImageAuthorization }: ReportOptionsFieldsProps) {
  function set<K extends keyof ReportOptions>(key: K, next: ReportOptions[K]) {
    onChange({ ...value, [key]: next });
  }

  const periodError = reportOptionsError(value);

  return (
    <div className="report-options">
      <div className="field">
        <label className="field__label" htmlFor="report-from">
          Período de referência
        </label>
        <div className="report-period">
          <TextInput
            id="report-from"
            type="date"
            aria-label="Início do período"
            value={value.from}
            invalid={Boolean(periodError)}
            onChange={(event) => set('from', event.target.value)}
          />
          <span className="report-period__sep">a</span>
          <TextInput
            type="date"
            aria-label="Fim do período"
            value={value.to}
            invalid={Boolean(periodError)}
            onChange={(event) => set('to', event.target.value)}
          />
        </div>
        {periodError ? (
          <span className="field__error">{periodError}</span>
        ) : (
          <span className="field__hint">
            Em branco, todo o histórico. Com período, entram só os registros (com as fotos) e as tarefas concluídas
            dentro dele; indicadores e equipe saem como estão hoje.
          </span>
        )}
      </div>

      <div className="report-options__checks">
        <span className="field__hint">Indicadores, voluntários e linha do tempo sempre entram. Também incluir:</span>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.includeTasks}
            onChange={(event) => set('includeTasks', event.target.checked)}
          />
          Tarefas concluídas
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.includePhotos}
            onChange={(event) => set('includePhotos', event.target.checked)}
          />
          Registro fotográfico
        </label>
      </div>

      {value.includePhotos && withoutImageAuthorization.length > 0 ? (
        <Alert kind="warning">
          {withoutImageAuthorization.length === 1
            ? `${withoutImageAuthorization[0]} não tem`
            : `${withoutImageAuthorization.length} projetos selecionados não têm`}{' '}
          autorização de uso de imagem dos beneficiários registrada
          {withoutImageAuthorization.length === 1 ? '' : `: ${withoutImageAuthorization.join(', ')}`}. As fotos entram
          no relatório; confira se podem ser usadas.
        </Alert>
      ) : null}

      <Field
        label="Observação do relatório"
        htmlFor="report-note"
        hint="Aparece no início do documento. Ex.: finalidade ou parceiro."
      >
        <TextArea id="report-note" value={value.note} onChange={(event) => set('note', event.target.value)} />
      </Field>
    </div>
  );
}
