import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Indicator, ProjectDetail, SaveIndicatorPayload } from '../../types/api';
import { emptyToNull, formatNumber } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface IndicatorsTabProps {
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => void;
}

export function IndicatorsTab({ project, canManage, onChanged }: IndicatorsTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [removing, setRemoving] = useState<Indicator | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await indicatorsApi.remove(removing.id);
      notify('Indicador excluído.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o indicador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 520 }}>
          Registre números simples de resultado — pessoas beneficiadas, famílias atendidas, horas voluntárias,
          materiais utilizados.
        </p>
        <div className="toolbar__right">
          <Button
            variant="primary"
            small
            icon={<IconPlus size={15} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Novo indicador
          </Button>
        </div>
      </div>

      <div className="panel">
        {project.indicators.length === 0 ? (
          <EmptyState
            title="Nenhum indicador definido"
            description="Registre ao menos um indicador para mostrar resultados em relatórios e prestação de contas."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Criar indicador
              </Button>
            }
          />
        ) : (
          <div className="panel__body">
            {project.indicators.map((indicator) => (
              <div className="indicator" key={indicator.id}>
                <div className="indicator__top">
                  <div className="indicator__name">{indicator.name}</div>
                  <div className="indicator__values num">
                    <strong>{formatNumber(indicator.value)}</strong>
                    {indicator.unit ? ` ${indicator.unit}` : ''}
                  </div>
                  <div className="row-actions" style={{ marginLeft: 8 }}>
                    <Button
                      small
                      variant="ghost"
                      icon={<IconEdit size={15} />}
                      title="Editar indicador"
                      aria-label="Editar indicador"
                      onClick={() => {
                        setEditing(indicator);
                        setFormOpen(true);
                      }}
                    />
                    {canManage ? (
                      <Button
                        small
                        variant="ghost"
                        icon={<IconTrash size={15} />}
                        title="Excluir indicador"
                        aria-label="Excluir indicador"
                        onClick={() => setRemoving(indicator)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen ? (
        <IndicatorFormModal
          projectId={project.id}
          indicator={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Indicador atualizado.' : 'Indicador criado.');
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir indicador"
          message={`O indicador "${removing.name}" será removido do projeto.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

interface IndicatorFormModalProps {
  projectId: string;
  indicator: Indicator | null;
  onClose: () => void;
  onSaved: () => void;
}

function IndicatorFormModal({ projectId, indicator, onClose, onSaved }: IndicatorFormModalProps) {
  const [name, setName] = useState(indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.unit ?? '');
  const [value, setValue] = useState(String(indicator?.value ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Informe o nome do indicador.';
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) found.value = 'Informe um valor válido.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: SaveIndicatorPayload = {
      name: name.trim(),
      unit: emptyToNull(unit),
      value: Number(value)
    };

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
          <Field label="Nome" htmlFor="indicator-name" required error={errors.name} span>
            <TextInput
              id="indicator-name"
              value={name}
              invalid={Boolean(errors.name)}
              placeholder="Ex.: Pessoas beneficiadas"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Valor" htmlFor="indicator-value" required error={errors.value}>
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

          <Field label="Unidade" htmlFor="indicator-unit" hint="Ex.: pessoas, famílias, horas, unidades.">
            <TextInput id="indicator-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
