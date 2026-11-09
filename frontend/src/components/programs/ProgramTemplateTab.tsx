import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type {
  ActivityPriority,
  ProgramTemplate,
  SaveProgramTemplatePayload,
  TemplateActivity,
  TemplateIndicator
} from '../../types/api';
import { emptyToNull } from '../../utils/format';
import { NationalIndicatorField, useNationalIndicators } from '../indicators/NationalIndicatorField';
import { UrgentBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../ui/Feedback';
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** "sem prazo", "prazo: no início", "prazo: 7 dias após o início" */
export function dueDaysLabel(days: number | null) {
  if (days === null) return 'sem prazo';
  if (days === 0) return 'prazo: no início';
  return `prazo: ${days} dia${days === 1 ? '' : 's'} após o início`;
}

/** Itens novos ainda sem id da API. */
const NEW_ID = 'novo';

function toPayload(template: ProgramTemplate): SaveProgramTemplatePayload {
  return {
    activities: template.activities.map((item) => ({ ...item, id: item.id === NEW_ID ? null : item.id })),
    indicators: template.indicators.map((item) => ({ ...item, id: item.id === NEW_ID ? null : item.id }))
  };
}

function move<T>(list: T[], index: number, offset: number) {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + offset, 0, item);
  return next;
}

interface ProgramTemplateTabProps {
  programId: string;
  canEdit: boolean;
  /** O resumo do modelo (no cabecalho e nos cards) muda junto. */
  onChanged: () => void;
}

/**
 * Editar programa › Modelo de projeto: tarefas padrao e indicadores padrao (os textos do projeto novo vem da ficha do
 * programa, na aba Sobre). Cada mudanca grava o modelo inteiro (a API recebe a lista como ficou).
 */
export function ProgramTemplateTab({ programId, canEdit, onChanged }: ProgramTemplateTabProps) {
  const { notify, notifyError } = useToast();
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ index: number; item: TemplateActivity | null } | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<{ index: number; item: TemplateIndicator | null } | null>(null);
  const [removing, setRemoving] = useState<{ kind: 'activity' | 'indicator'; index: number; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTemplate(await programsApi.template(programId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o modelo.');
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Grava o modelo com a mudanca. Erros sobem para quem chamou (o modal mostra a mensagem). */
  async function save(next: ProgramTemplate, message: string) {
    const saved = await programsApi.saveTemplate(programId, toPayload(next));
    setTemplate(saved);
    if (message) notify(message);
    onChanged();
  }

  async function saveQuietly(next: ProgramTemplate, message: string) {
    setBusy(true);
    try {
      await save(next, message);
      return true;
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar o modelo.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!template) return <Loading label="Carregando modelo…" />;

  const { activities, indicators } = template;

  return (
    <>
      <p className="field__hint template__intro">
        O que cada projeto novo deste programa já recebe, com "Usar o modelo do programa" marcado: as tarefas (sem
        responsável) e os indicadores (em branco). A descrição e o objetivo vêm da aba Sobre. Mudar o modelo não altera
        os projetos que já existem.
      </p>

      <div className="template-grid">
        <section className="panel">
          <div className="panel__head">
            <h2>Tarefas padrão</h2>
            <span className="tab__count num">{activities.length}</span>
            {canEdit ? (
              <div className="panel__actions">
                <Button small icon={<IconPlus size={15} />} onClick={() => setEditingActivity({ index: -1, item: null })}>
                  Tarefa
                </Button>
              </div>
            ) : null}
          </div>
          {activities.length === 0 ? (
            <EmptyState
              title="Nenhuma tarefa padrão"
              description="Inclua as etapas que todo projeto deste programa costuma ter."
            />
          ) : (
            <ol className="template-list">
              {activities.map((activity, index) => (
                <li key={activity.id} className="template-list__item">
                  <span className="template-list__index num">{index + 1}</span>
                  <div className="template-list__main">
                    <div className="template-list__title">{activity.title}</div>
                    <div className="template-list__meta">
                      <UrgentBadge priority={activity.priority} />
                      <span>{dueDaysLabel(activity.dueDays)}</span>
                    </div>
                    {activity.description ? <p className="template-list__desc">{activity.description}</p> : null}
                  </div>
                  {canEdit ? (
                    <div className="row-actions">
                      <Button
                        small
                        variant="ghost"
                        icon={<IconChevronUp size={15} />}
                        title="Subir"
                        aria-label={`Subir "${activity.title}"`}
                        disabled={busy || index === 0}
                        onClick={() =>
                          void saveQuietly({ ...template, activities: move(activities, index, -1) }, '')
                        }
                      />
                      <Button
                        small
                        variant="ghost"
                        icon={<IconChevronDown size={15} />}
                        title="Descer"
                        aria-label={`Descer "${activity.title}"`}
                        disabled={busy || index === activities.length - 1}
                        onClick={() =>
                          void saveQuietly({ ...template, activities: move(activities, index, 1) }, '')
                        }
                      />
                      <Button
                        small
                        variant="ghost"
                        icon={<IconEdit size={15} />}
                        title="Editar"
                        aria-label={`Editar "${activity.title}"`}
                        onClick={() => setEditingActivity({ index, item: activity })}
                      />
                      <Button
                        small
                        variant="ghost"
                        icon={<IconTrash size={15} />}
                        title="Remover"
                        aria-label={`Remover "${activity.title}"`}
                        onClick={() => setRemoving({ kind: 'activity', index, label: activity.title })}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="template-side">
          <section className="panel">
            <div className="panel__head">
              <h2>Indicadores padrão</h2>
              <span className="tab__count num">{indicators.length}</span>
              {canEdit ? (
                <div className="panel__actions">
                  <Button small icon={<IconPlus size={15} />} onClick={() => setEditingIndicator({ index: -1, item: null })}>
                    Indicador
                  </Button>
                </div>
              ) : null}
            </div>
            {indicators.length === 0 ? (
              <EmptyState title="Nenhum indicador padrão" description="Ex.: famílias atendidas, banheiros construídos." />
            ) : (
              <ul className="template-list">
                {indicators.map((indicator, index) => (
                  <li key={indicator.id} className="template-list__item">
                    <div className="template-list__main">
                      <div className="template-list__title">
                        {indicator.name}
                        {indicator.nationalIndicatorId ? (
                          <span className="national-mark" title="Indicador nacional: entra na soma de todos os núcleos">
                            nacional
                          </span>
                        ) : null}
                      </div>
                      {indicator.unit ? <div className="template-list__meta">{indicator.unit}</div> : null}
                    </div>
                    {canEdit ? (
                      <div className="row-actions">
                        <Button
                          small
                          variant="ghost"
                          icon={<IconEdit size={15} />}
                          title="Editar"
                          aria-label={`Editar "${indicator.name}"`}
                          onClick={() => setEditingIndicator({ index, item: indicator })}
                        />
                        <Button
                          small
                          variant="ghost"
                          icon={<IconTrash size={15} />}
                          title="Remover"
                          aria-label={`Remover "${indicator.name}"`}
                          onClick={() => setRemoving({ kind: 'indicator', index, label: indicator.name })}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {editingActivity ? (
        <TemplateActivityModal
          activity={editingActivity.item}
          onClose={() => setEditingActivity(null)}
          onSave={async (values) => {
            const list =
              editingActivity.index < 0
                ? [...activities, { ...values, id: NEW_ID }]
                : activities.map((item, i) => (i === editingActivity.index ? { ...item, ...values } : item));
            await save({ ...template, activities: list }, editingActivity.item ? 'Tarefa atualizada.' : 'Tarefa incluída.');
            setEditingActivity(null);
          }}
        />
      ) : null}

      {editingIndicator ? (
        <TemplateIndicatorModal
          indicator={editingIndicator.item}
          onClose={() => setEditingIndicator(null)}
          onSave={async (values) => {
            const list =
              editingIndicator.index < 0
                ? [...indicators, { ...values, id: NEW_ID }]
                : indicators.map((item, i) => (i === editingIndicator.index ? { ...item, ...values } : item));
            await save({ ...template, indicators: list }, editingIndicator.item ? 'Indicador atualizado.' : 'Indicador incluído.');
            setEditingIndicator(null);
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={removing.kind === 'activity' ? 'Remover tarefa padrão' : 'Remover indicador padrão'}
          message={`"${removing.label}" sai do modelo. Os projetos que já existem não mudam.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const next =
              removing.kind === 'activity'
                ? { ...template, activities: activities.filter((_, i) => i !== removing.index) }
                : { ...template, indicators: indicators.filter((_, i) => i !== removing.index) };
            void saveQuietly(next, 'Removido do modelo.').then((ok) => ok && setRemoving(null));
          }}
        />
      ) : null}
    </>
  );
}

/** Formulario comum dos modais: erro da API no topo e "Salvar" chamando onSave. */
function useModalSave<T>(onSave: (values: T) => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function run(values: T) {
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o modelo.');
    } finally {
      setSaving(false);
    }
  }

  return { error, setError, saving, run };
}

function TemplateActivityModal({
  activity,
  onClose,
  onSave
}: {
  activity: TemplateActivity | null;
  onClose: () => void;
  onSave: (values: Omit<TemplateActivity, 'id'>) => Promise<void>;
}) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [priority, setPriority] = useState<ActivityPriority>(activity?.priority ?? 'Media');
  const [dueDays, setDueDays] = useState(activity?.dueDays != null ? String(activity.dueDays) : '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const { error, setError, saving, run } = useModalSave(onSave);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (title.trim().length < 3) return setError('Informe um título com ao menos 3 caracteres.');
    const days = dueDays.trim() === '' ? null : Number(dueDays);
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 3650))
      return setError('O prazo deve ser um número inteiro de dias (ou em branco).');
    void run({ title: title.trim(), priority, dueDays: days, description: emptyToNull(description) });
  }

  return (
    <Modal
      guardChanges
      title={activity ? 'Editar tarefa padrão' : 'Nova tarefa padrão'}
      subtitle="Entra em cada projeto novo do programa, sem responsável."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => submit()}>
            Salvar
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={submit} className="form-grid form-grid--single">
        <Field label="Título" htmlFor="template-activity-title" required>
          <TextInput
            id="template-activity-title"
            autoFocus
            value={title}
            placeholder="Ex.: Visita técnica e levantamento"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Prioridade">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={priority === 'Alta'}
              onChange={(event) => setPriority(event.target.checked ? 'Alta' : 'Media')}
            />
            Urgente
          </label>
        </Field>
        <Field
          label="Prazo (dias após o início do projeto)"
          htmlFor="template-activity-due"
          hint="Deixe em branco para a tarefa nascer sem prazo."
        >
          <TextInput
            id="template-activity-due"
            type="number"
            min={0}
            max={3650}
            value={dueDays}
            placeholder="Sem prazo"
            onChange={(event) => setDueDays(event.target.value)}
          />
        </Field>
        <Field label="Descrição" htmlFor="template-activity-description" hint="O que precisa ser feito, em poucas linhas.">
          <TextArea
            id="template-activity-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}

function TemplateIndicatorModal({
  indicator,
  onClose,
  onSave
}: {
  indicator: TemplateIndicator | null;
  onClose: () => void;
  onSave: (values: Omit<TemplateIndicator, 'id'>) => Promise<void>;
}) {
  const nationals = useNationalIndicators();
  const [nationalId, setNationalId] = useState(indicator?.nationalIndicatorId ?? '');
  const [name, setName] = useState(indicator?.nationalIndicatorId ? '' : indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.nationalIndicatorId ? '' : indicator?.unit ?? '');
  const { error, setError, saving, run } = useModalSave(onSave);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (nationalId) {
      // Nacional: nome e unidade vem dele (a API confere e grava os dele).
      const national = nationals.find((item) => item.id === nationalId);
      void run({
        name: national?.name ?? indicator?.name ?? 'Indicador nacional',
        unit: national?.unit ?? indicator?.unit ?? null,
        nationalIndicatorId: nationalId
      });
      return;
    }
    if (name.trim().length < 2) return setError('Informe o nome do indicador.');
    void run({ name: name.trim(), unit: emptyToNull(unit), nationalIndicatorId: null });
  }

  return (
    <Modal
      guardChanges
      title={indicator ? 'Editar indicador padrão' : 'Novo indicador padrão'}
      subtitle="Entra zerado em cada projeto novo do programa."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => submit()}>
            Salvar
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={submit} className="form-grid form-grid--single">
        <NationalIndicatorField
          id="template-indicator-national"
          value={nationalId}
          onChange={setNationalId}
          options={nationals}
          scope="programa"
          linked={indicator?.nationalIndicatorId ? { id: indicator.nationalIndicatorId, name: indicator.name } : null}
        />
        {!nationalId ? (
          <>
            <Field label="Nome" htmlFor="template-indicator-name" required>
              <TextInput
                id="template-indicator-name"
                autoFocus
                value={name}
                placeholder="Ex.: Famílias atendidas"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Unidade" htmlFor="template-indicator-unit">
              <TextInput
                id="template-indicator-unit"
                maxLength={60}
                value={unit}
                placeholder="Ex.: famílias, m², un."
                onChange={(event) => setUnit(event.target.value)}
              />
            </Field>
          </>
        ) : null}
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
