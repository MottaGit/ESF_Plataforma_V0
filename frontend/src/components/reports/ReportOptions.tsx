import type { ReportPayload } from '../../types/api';
import { Field, TextArea } from '../ui/Field';
import { Alert } from '../ui/Feedback';

/** O que a pessoa escolhe sobre o conteudo do PDF (os projetos vem de quem abriu as opcoes). */
export interface ReportOptions {
  includePhotos: boolean;
  note: string;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = { includePhotos: true, note: '' };

/** Pedido do PDF: indicadores, voluntarios e linha do tempo sempre entram. */
export function reportPayload(projectIds: string[], options: ReportOptions): ReportPayload {
  return {
    projectIds,
    includeVolunteers: true,
    includeIndicators: true,
    includeUpdates: true,
    includePhotos: options.includePhotos,
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

  return (
    <div className="report-options">
      <p className="field__hint">
        Indicadores, voluntários e linha do tempo sempre entram no PDF. Só as fotos anexadas aos registros de andamento
        são opcionais.
      </p>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.includePhotos}
          onChange={(event) => set('includePhotos', event.target.checked)}
        />
        Registro fotográfico
      </label>

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
        hint="Aparece no início do documento. Ex.: finalidade, parceiro ou período de referência."
      >
        <TextArea id="report-note" value={value.note} onChange={(event) => set('note', event.target.value)} />
      </Field>
    </div>
  );
}
