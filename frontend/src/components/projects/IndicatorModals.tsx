import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import type { Indicator, SaveIndicatorPayload } from '../../types/api';
import { emptyToNull } from '../../utils/format';
import { NationalIndicatorField, useNationalIndicators } from '../indicators/NationalIndicatorField';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

interface IndicatorFormModalProps {
  projectId: string;
  indicator: Indicator | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Indicador novo ou edicao completa (nacional ou especifico, nome, valor e unidade). */
export function IndicatorFormModal({ projectId, indicator, onClose, onSaved }: IndicatorFormModalProps) {
  const nationals = useNationalIndicators();
  const [nationalId, setNationalId] = useState(indicator?.nationalIndicatorId ?? '');
  const [name, setName] = useState(indicator?.nationalIndicatorId ? '' : indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.nationalIndicatorId ? '' : indicator?.unit ?? '');
  const [value, setValue] = useState(String(indicator?.value ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const national = nationals.find((item) => item.id === nationalId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: Record<string, string> = {};
    if (!nationalId && name.trim().length < 2) found.name = 'Informe o nome do indicador.';
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) found.value = 'Informe um valor válido.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Indicador nacional: o nome e a unidade vem dele (a API ignora os daqui).
    const payload: SaveIndicatorPayload = nationalId
      ? {
          name: national?.name ?? indicator?.name ?? 'Indicador nacional',
          unit: national?.unit ?? indicator?.unit ?? null,
          value: Number(value),
          nationalIndicatorId: nationalId
        }
      : { name: name.trim(), unit: emptyToNull(unit), value: Number(value), nationalIndicatorId: null };

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
      title={indicator ? 'Editar indicador' : 'Novo indicador'}
      subtitle="Um número simples de resultado."
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
          <NationalIndicatorField
            id="indicator-national"
            value={nationalId}
            onChange={setNationalId}
            options={nationals}
            scope="projeto"
            linked={indicator?.nationalIndicatorId ? { id: indicator.nationalIndicatorId, name: indicator.name } : null}
          />

          {!nationalId ? (
            <Field label="Nome" htmlFor="indicator-name" required error={errors.name} span>
              <TextInput
                id="indicator-name"
                value={name}
                invalid={Boolean(errors.name)}
                placeholder="Ex.: Pessoas beneficiadas"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          ) : null}

          <Field
            label="Valor"
            htmlFor="indicator-value"
            required
            error={errors.value}
            hint={nationalId && national?.unit ? `Em ${national.unit}.` : undefined}
          >
            <TextInput
              id="indicator-value"
              type="number"
              min={0}
              step="0.01"
              value={value}
              invalid={Boolean(errors.value)}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>

          {!nationalId ? (
            <Field label="Unidade" htmlFor="indicator-unit" hint="Ex.: pessoas, famílias, horas, unidades.">
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
  const [value, setValue] = useState(String(indicator.value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) {
      setError('Informe um valor válido.');
      return;
    }

    setSaving(true);
    try {
      await indicatorsApi.update(indicator.id, {
        name: indicator.name,
        unit: indicator.unit,
        value: Number(value),
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
      title={indicator.name}
      subtitle="Atualize o número. Nome e unidade se mudam na aba Sobre."
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
          required
          error={error ?? undefined}
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
