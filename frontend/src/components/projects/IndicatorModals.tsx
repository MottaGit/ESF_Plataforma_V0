import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import type { Indicator, SaveIndicatorPayload } from '../../types/api';
import { emptyToNull } from '../../utils/format';
import { useNationalIndicators } from '../indicators/NationalIndicatorField';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

const BLANK_HINT = 'Em branco: ainda não informado (não conta como zero).';

/** Valor digitado: vazio vira "nao informado" (null); undefined quando nao e um numero valido. */
function parseValue(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isNaN(value) || value < 0 ? undefined : value;
}

/** "Como contar" do indicador nacional, quando a gestao nacional escreveu. */
function useHowToCount(indicator: Indicator | null) {
  const nationals = useNationalIndicators();
  const national = indicator?.nationalIndicatorId
    ? nationals.find((item) => item.id === indicator.nationalIndicatorId)
    : undefined;
  return national?.description ? `Como contar: ${national.description}` : null;
}

interface IndicatorFormModalProps {
  projectId: string;
  indicator: Indicator | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Indicador do projeto: novo (sempre especifico; os nacionais ja estao em todo projeto) ou edicao. No nacional, nome e
 * unidade vem da gestao nacional e so o valor muda.
 */
export function IndicatorFormModal({ projectId, indicator, onClose, onSaved }: IndicatorFormModalProps) {
  const isNational = Boolean(indicator?.nationalIndicatorId);
  const howToCount = useHowToCount(indicator);
  const [name, setName] = useState(indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.unit ?? '');
  const [value, setValue] = useState(indicator?.value == null ? '' : String(indicator.value));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = parseValue(value);
    const found: Record<string, string> = {};
    if (!isNational && name.trim().length < 2) found.name = 'Informe o nome do indicador.';
    if (parsed === undefined) found.value = 'Informe um número (0 ou mais) ou deixe em branco.';

    setErrors(found);
    if (Object.keys(found).length > 0 || parsed === undefined) return;

    const payload: SaveIndicatorPayload = isNational
      ? { name: indicator!.name, unit: indicator!.unit, value: parsed, nationalIndicatorId: indicator!.nationalIndicatorId }
      : { name: name.trim(), unit: emptyToNull(unit), value: parsed, nationalIndicatorId: null };

    setSaving(true);
    try {
      if (indicator) await indicatorsApi.update(indicator.id, payload);
      else await indicatorsApi.create(projectId, payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o indicador.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={isNational ? indicator!.name : indicator ? 'Editar indicador' : 'Novo indicador'}
      subtitle={
        isNational
          ? 'Indicador nacional: está em todo projeto e entra na soma de todos os núcleos. Nome e unidade vêm da gestão nacional.'
          : indicator
            ? 'Um número simples de resultado.'
            : 'Um número de resultado deste projeto. Os indicadores nacionais já estão em todo projeto.'
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {formError ? (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{formError}</Alert>
          </div>
        ) : null}

        <div className="form-grid">
          {!isNational ? (
            <Field label="Nome" htmlFor="indicator-name" required error={errors.name} span>
              <TextInput
                id="indicator-name"
                value={name}
                invalid={Boolean(errors.name)}
                placeholder="Ex.: Área construída"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          ) : null}

          <Field
            label={isNational && indicator?.unit ? `Valor (${indicator.unit})` : 'Valor'}
            htmlFor="indicator-value"
            error={errors.value}
            hint={isNational && howToCount ? `${howToCount} ${BLANK_HINT}` : BLANK_HINT}
            span={isNational}
          >
            <TextInput
              id="indicator-value"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={value}
              invalid={Boolean(errors.value)}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>

          {!isNational ? (
            <Field label="Unidade" htmlFor="indicator-unit" hint="Ex.: m², unidades, oficinas.">
              <TextInput id="indicator-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
            </Field>
          ) : null}
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}

interface IndicatorValueModalProps {
  indicator: Indicator;
  onClose: () => void;
  onSaved: () => void;
}

/** So o valor, a partir da faixa do topo do projeto: e o que muda no dia a dia. Nome e unidade ficam em Sobre. */
export function IndicatorValueModal({ indicator, onClose, onSaved }: IndicatorValueModalProps) {
  const howToCount = useHowToCount(indicator);
  const [value, setValue] = useState(indicator.value == null ? '' : String(indicator.value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseValue(value);
    if (parsed === undefined) {
      setError('Informe um número (0 ou mais) ou deixe em branco.');
      return;
    }

    setSaving(true);
    try {
      await indicatorsApi.update(indicator.id, {
        name: indicator.name,
        unit: indicator.unit,
        value: parsed,
        nationalIndicatorId: indicator.nationalIndicatorId
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o valor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={indicator.name}
      subtitle={
        indicator.nationalIndicatorId
          ? 'Indicador nacional: entra na soma de todos os núcleos.'
          : 'Atualize o número. Nome e unidade se mudam na aba Sobre.'
      }
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Field
          label={indicator.unit ? `Valor (${indicator.unit})` : 'Valor'}
          htmlFor="indicator-quick-value"
          error={error ?? undefined}
          hint={howToCount ? `${howToCount} ${BLANK_HINT}` : BLANK_HINT}
        >
          <TextInput
            id="indicator-quick-value"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={value}
            invalid={Boolean(error)}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
