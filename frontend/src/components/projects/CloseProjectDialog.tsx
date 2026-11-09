import { useState } from 'react';
import { ApiError } from '../../api/client';
import { indicatorsApi, projectUpdatesApi, projectsApi } from '../../api/endpoints';
import type { Indicator, ProjectDetail } from '../../types/api';
import { todayInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import { plainTextToHtml } from '../ui/RichText';
import { parseIndicatorValue } from './IndicatorModals';

interface CloseProjectDialogProps {
  project: ProjectDetail;
  status: 'Concluido' | 'Cancelado';
  onCancel: () => void;
  /** Status gravado; recordError diz se o registro de encerramento nao foi publicado. */
  onClosed: (recordError: string | null) => void;
  /** "Ver tarefas": fecha a janela sem mudar nada e abre a aba Tarefas. */
  onOpenTasks: () => void;
}

/** Valor do indicador como aparece no campo ("" quando ainda nao foi informado). */
const asText = (indicator: Indicator) => (indicator.value == null ? '' : String(indicator.value));

/**
 * Confirmacao ao concluir ou cancelar um projeto: o dia em que isso aconteceu, as tarefas em aberto e um registro de
 * encerramento opcional, publicado no Andamento (e por isso tambem no relatorio). Ao concluir, pede tambem os numeros
 * finais dos indicadores: e quando se sabe o resultado, e o que fica em branco nao entra nas somas.
 */
export function CloseProjectDialog({ project, status, onCancel, onClosed, onOpenTasks }: CloseProjectDialogProps) {
  const concluding = status === 'Concluido';
  const today = todayInputValue();
  const [closedOn, setClosedOn] = useState(today);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(project.indicators.map((indicator) => [indicator.id, asText(indicator)]))
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = project.activities.filter((activity) => activity.status !== 'Concluida');
  const late = open.filter((activity) => activity.isLate).length;
  const blocked = open.filter((activity) => activity.status === 'Bloqueada').length;
  const details = [
    late > 0 ? `${late} ${late === 1 ? 'atrasada' : 'atrasadas'}` : null,
    blocked > 0 ? `${blocked} ${blocked === 1 ? 'bloqueada' : 'bloqueadas'}` : null
  ].filter(Boolean);
  const indicators = concluding ? project.indicators : [];
  const blank = indicators.filter((indicator) => (values[indicator.id] ?? '').trim() === '').length;

  function validate() {
    const found: Record<string, string> = {};
    if (closedOn && closedOn > today) found.closedOn = 'Não pode ser depois de hoje.';
    else if (concluding && closedOn && closedOn < project.startDate.slice(0, 10))
      found.closedOn = 'A conclusão não pode ser antes do início do projeto.';
    for (const indicator of indicators) {
      if (parseIndicatorValue(values[indicator.id] ?? '') === undefined)
        found[indicator.id] = 'Informe um número (0 ou mais) ou deixe em branco.';
    }
    const text = note.trim();
    if (text.length > 0 && text.length < 3) found.note = 'O registro precisa ter pelo menos 3 caracteres.';
    setFieldErrors(found);
    return Object.keys(found).length === 0;
  }

  async function confirm() {
    setError(null);
    if (!validate()) return;
    setBusy(true);

    // Primeiro os numeros: se algum falhar, nada mais muda e a pessoa tenta de novo.
    for (const indicator of indicators) {
      const text = values[indicator.id] ?? '';
      if (text.trim() === asText(indicator)) continue;
      try {
        await indicatorsApi.update(indicator.id, {
          name: indicator.name,
          unit: indicator.unit,
          value: parseIndicatorValue(text) ?? null,
          nationalIndicatorId: indicator.nationalIndicatorId
        });
      } catch (err) {
        setError(
          `Não foi possível salvar "${indicator.name}": ${err instanceof ApiError ? err.message : 'tente de novo.'}`
        );
        setBusy(false);
        return;
      }
    }

    try {
      await projectsApi.updateStatus(project.id, status, closedOn || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar o status.');
      setBusy(false);
      return;
    }

    // O status ja mudou: se o registro falhar, a pagina avisa e ele pode ser publicado pelo Andamento.
    let recordError: string | null = null;
    const text = note.trim();
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
      guardChanges
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
          label={concluding ? 'Concluído em' : 'Cancelado em'}
          htmlFor="close-project-day"
          error={fieldErrors.closedOn}
          hint="O dia em que terminou. Sai no relatório e na página pública."
        >
          <TextInput
            id="close-project-day"
            type="date"
            value={closedOn}
            max={today}
            invalid={Boolean(fieldErrors.closedOn)}
            onChange={(event) => setClosedOn(event.target.value)}
          />
        </Field>

        {indicators.length > 0 ? (
          <fieldset className="close-project__results">
            <legend className="field__label">Resultados do projeto</legend>
            <p className="field__hint">
              Confira os números finais: vão para o relatório, a página pública e a soma de todos os núcleos. Em branco
              fica "não informado" (não conta como zero).
              {blank > 0 ? (
                <strong className="close-project__blank">
                  {' '}
                  {blank === 1 ? '1 ainda não informado.' : `${blank} ainda não informados.`}
                </strong>
              ) : null}
            </p>
            {indicators.map((indicator) => (
              <div key={indicator.id} className="close-project__result">
                <label htmlFor={`close-result-${indicator.id}`} className="close-project__result-name">
                  {indicator.name}
                  {indicator.nationalIndicatorId ? <span className="national-mark">nacional</span> : null}
                  {indicator.unit ? <span className="close-project__result-unit">{indicator.unit}</span> : null}
                </label>
                <TextInput
                  id={`close-result-${indicator.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="não informado"
                  value={values[indicator.id] ?? ''}
                  invalid={Boolean(fieldErrors[indicator.id])}
                  onChange={(event) => setValues((current) => ({ ...current, [indicator.id]: event.target.value }))}
                />
                {fieldErrors[indicator.id] ? (
                  <span className="field__error close-project__result-error">{fieldErrors[indicator.id]}</span>
                ) : null}
              </div>
            ))}
          </fieldset>
        ) : null}

        <Field
          label={concluding ? 'Registro de encerramento' : 'Motivo do cancelamento'}
          htmlFor="close-project-note"
          error={fieldErrors.note}
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
