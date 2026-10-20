import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Indicator, ProjectDetail, SaveIndicatorPayload } from '../../types/api';
import { emptyToNull, formatDate, formatDateTime, formatNumber } from '../../utils/format';
import { SignedDocumentsPanel } from '../documents/SignedDocumentsPanel';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface AboutTabProps {
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => void;
}

/** Dados cadastrais do projeto e seus indicadores de resultado. */
export function AboutTab({ project, canManage, onChanged }: AboutTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [removing, setRemoving] = useState<Indicator | null>(null);
  const [busy, setBusy] = useState(false);

  const location = [project.address, project.district, project.city, project.state].filter(Boolean).join(', ');

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

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
      <div className="grid-sidebar">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel__head">
              <h2>Sobre o projeto</h2>
            </div>
            <div className="panel__body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div className="meta__label">Descrição</div>
                  <p className="meta__value about__text">{project.description ?? 'Sem descrição registrada.'}</p>
                </div>
                <div>
                  <div className="meta__label">Objetivo</div>
                  <p className="meta__value about__text">{project.objective ?? 'Sem objetivo registrado.'}</p>
                </div>
                {project.notes ? (
                  <div>
                    <div className="meta__label">Observações</div>
                    <p className="meta__value about__text">{project.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Indicadores do projeto</h2>
              <div className="panel__actions">
                <Button variant="primary" small icon={<IconPlus size={15} />} onClick={openNew}>
                  Novo indicador
                </Button>
              </div>
            </div>
            <div className="panel__body">
              {project.indicators.length === 0 ? (
                <EmptyState
                  title="Sem indicadores"
                  description="Registre indicadores para mostrar resultados em relatórios e prestação de contas."
                  action={
                    <Button variant="primary" onClick={openNew}>
                      Criar indicador
                    </Button>
                  }
                />
              ) : (
                project.indicators.map((indicator) => (
                  <div className="indicator" key={indicator.id}>
                    <div className="indicator__top">
                      <span className="indicator__name">{indicator.name}</span>
                      <span className="indicator__values num">
                        <strong>{formatNumber(indicator.value)}</strong>
                        {indicator.unit ? ` ${indicator.unit}` : ''}
                      </span>
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
                ))
              )}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Informações gerais</h2>
          </div>
          <div className="panel__body">
            <div className="meta-list">
              <MetaItem label="Programa" value={project.programName} />
              <MetaItem label="Responsável" value={project.ownerName ?? 'Não definido'} />
              <MetaItem
                label="Período"
                value={`${formatDate(project.startDate)} até ${
                  project.endDateForecast ? formatDate(project.endDateForecast) : 'sem previsão'
                }`}
              />
              <MetaItem label="Comunidade ou beneficiários" value={project.beneficiaries ?? '—'} />
              <MetaItem label="Público beneficiado" value={project.targetAudience ?? '—'} />
              <MetaItem label="Localização" value={location || '—'} />
              <div>
                <div className="meta__label">No mapa</div>
                <div className="meta__value">
                  {project.latitude != null && project.longitude != null ? (
                    <Link to={`/projetos?exibir=mapa&foco=${project.id}`}>Ver no mapa</Link>
                  ) : (
                    'Ainda não marcado (Editar projeto › Marcar no mapa)'
                  )}
                </div>
              </div>
              <MetaItem label="Criado em" value={formatDateTime(project.createdAt)} />
              <MetaItem label="Última alteração" value={formatDateTime(project.updatedAt)} />
            </div>
          </div>
        </section>

        {canManage ? (
          <SignedDocumentsPanel
            owner={{ type: 'project', id: project.id }}
            title="Autorização de imagem dos beneficiários"
            description="Necessária para usar fotos que mostram as famílias atendidas em relatórios e redes. Gere o termo, colha a assinatura de cada família e envie as cópias."
            templateLabel="Gerar autorização para assinar"
            onChanged={onChanged}
          />
        ) : null}
        </div>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="meta__label">{label}</div>
      <div className="meta__value">{value}</div>
    </div>
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
