import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import type { Indicator, SaveIndicatorPayload } from '../../types/api';
import { emptyToNull, formatNumber } from '../../utils/format';
import { useNationalIndicators } from '../indicators/NationalIndicatorField';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

const BLANK_HINT = 'Em branco: ainda não informado (não conta como zero).';
const TARGET_HINT = 'Quanto o projeto pretende alcançar. O relatório mostra o realizado contra a meta. Em branco: sem meta.';

/** Valor digitado: vazio vira "nao informado" (null); undefined quando nao e um numero valido. */
export function parseIndicatorValue(text: string): number | null | undefined {
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
  const [target, setTarget] = useState(indicator?.target == null ? '' : String(indicator.target));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = parseIndicatorValue(value);
    const parsedTarget = parseIndicatorValue(target);
    const found: Record<string, string> = {};
    if (!isNational && name.trim().length < 2) found.name = 'Informe o nome do indicador.';
    if (parsed === undefined) found.value = 'Informe um número (0 ou mais) ou deixe em branco.';
    if (parsedTarget === undefined) found.target = 'Informe um número (0 ou mais) ou deixe em branco.';

    setErrors(found);
    if (Object.keys(found).length > 0 || parsed === undefined || parsedTarget === undefined) return;

    const payload: SaveIndicatorPayload = isNational
      ? {
          name: indicator!.name,
          unit: indicator!.unit,
          value: parsed,
          nationalIndicatorId: indicator!.nationalIndicatorId,
          target: parsedTarget
        }
      : { name: name.trim(), unit: emptyToNull(unit), value: parsed, nationalIndicatorId: null, target: parsedTarget };

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

          <Field label="Meta" htmlFor="indicator-target" error={errors.target} hint={TARGET_HINT} span>
            <TextInput
              id="indicator-target"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={target}
              invalid={Boolean(errors.target)}
              onChange={(event) => setTarget(event.target.value)}
            />
          </Field>
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
    const parsed = parseIndicatorValue(value);
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
        nationalIndicatorId: indicator.nationalIndicatorId,
        target: indicator.target
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
          hint={[
            indicator.target != null ? `Meta: ${formatNumber(indicator.target)}.` : null,
            howToCount,
            BLANK_HINT
          ]
            .filter(Boolean)
            .join(' ')}
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
