import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi, projectsApi } from '../../api/endpoints';
import type { Program, ProjectDetail, ProjectStatus, SaveProjectPayload, Volunteer } from '../../types/api';
import { PROJECT_STATUSES, emptyToNull, projectStatusLabel, todayInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

const NEW_PROGRAM_VALUE = '__new__';

interface ProjectFormModalProps {
  project: ProjectDetail | null;
  volunteers: Volunteer[];
  programs: Program[];
  onClose: () => void;
  onSaved: (project: ProjectDetail) => void;
}

interface FormState {
  name: string;
  description: string;
  programId: string;
  ownerVolunteerId: string;
  objective: string;
  beneficiaries: string;
  targetAudience: string;
  notes: string;
  address: string;
  district: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  startDate: string;
  endDateForecast: string;
  status: ProjectStatus;
  progress: string;
}

function initialState(project: ProjectDetail | null, fallbackProgramId: string): FormState {
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    programId: project?.programId ?? fallbackProgramId,
    ownerVolunteerId: project?.ownerVolunteerId ?? '',
    objective: project?.objective ?? '',
    beneficiaries: project?.beneficiaries ?? '',
    targetAudience: project?.targetAudience ?? '',
    notes: project?.notes ?? '',
    address: project?.address ?? '',
    district: project?.district ?? '',
    city: project?.city ?? '',
    state: project?.state ?? '',
    latitude: project?.latitude != null ? String(project.latitude) : '',
    longitude: project?.longitude != null ? String(project.longitude) : '',
    startDate: project?.startDate?.slice(0, 10) ?? todayInputValue(),
    endDateForecast: project?.endDateForecast?.slice(0, 10) ?? '',
    status: project?.status ?? 'Planejamento',
    progress: String(project?.progress ?? 0)
  };
}

export function ProjectFormModal({ project, volunteers, programs, onClose, onSaved }: ProjectFormModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(project, programs[0]?.id ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [programOptions, setProgramOptions] = useState<Program[]>(programs);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [programError, setProgramError] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);

  async function handleCreateProgram() {
    if (newProgramName.trim().length < 3) {
      setProgramError('Informe um nome com ao menos 3 caracteres.');
      return;
    }
    setProgramError(null);
    setCreatingBusy(true);
    try {
      const created = await programsApi.create({ name: newProgramName.trim() });
      setProgramOptions((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      update('programId', created.id);
      setCreatingProgram(false);
      setNewProgramName('');
    } catch (err) {
      setProgramError(err instanceof ApiError ? err.message : 'Não foi possível criar o programa.');
    } finally {
      setCreatingBusy(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function validate() {
    const found: Record<string, string> = {};

    if (form.name.trim().length < 3) found.name = 'Informe um nome com ao menos 3 caracteres.';
    if (!form.programId) found.programId = 'Selecione um programa.';
    if (!form.startDate) found.startDate = 'Informe a data de início.';
    if (form.endDateForecast && form.startDate && form.endDateForecast < form.startDate)
      found.endDateForecast = 'A previsão não pode ser anterior ao início.';

    const progress = Number(form.progress);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) found.progress = 'Use um valor entre 0 e 100.';

    if (form.latitude && Number.isNaN(Number(form.latitude))) found.latitude = 'Latitude inválida.';
    if (form.longitude && Number.isNaN(Number(form.longitude))) found.longitude = 'Longitude inválida.';

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload: SaveProjectPayload = {
      name: form.name.trim(),
      description: emptyToNull(form.description),
      programId: form.programId,
      ownerVolunteerId: form.ownerVolunteerId || null,
      objective: emptyToNull(form.objective),
      beneficiaries: emptyToNull(form.beneficiaries),
      targetAudience: emptyToNull(form.targetAudience),
      notes: emptyToNull(form.notes),
      address: emptyToNull(form.address),
      district: emptyToNull(form.district),
      city: emptyToNull(form.city),
      state: emptyToNull(form.state),
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      startDate: form.startDate,
      endDateForecast: form.endDateForecast || null,
      status: form.status,
      progress: Number(form.progress)
    };

    setSaving(true);
    try {
      const saved = project ? await projectsApi.update(project.id, payload) : await projectsApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o projeto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={project ? 'Editar projeto' : 'Novo projeto'}
      subtitle={project ? project.name : 'Os campos marcados com * são obrigatórios.'}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <span className="modal__foot-note">Você poderá completar as demais informações depois.</span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => handleSubmit(event)}>
            {project ? 'Salvar alterações' : 'Criar projeto'}
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
          <Field label="Nome do projeto" htmlFor="name" required error={errors.name} span>
            <TextInput
              id="name"
              value={form.name}
              invalid={Boolean(errors.name)}
              placeholder="Ex.: Reforma habitacional - Vila São José"
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>

          <Field label="Programa" htmlFor="program" required error={errors.programId ?? programError}>
            <Select
              id="program"
              value={creatingProgram ? NEW_PROGRAM_VALUE : form.programId}
              invalid={Boolean(errors.programId)}
              onChange={(event) => {
                const value = event.target.value;
                if (value === NEW_PROGRAM_VALUE) {
                  setCreatingProgram(true);
                } else {
                  setCreatingProgram(false);
                  update('programId', value);
                }
              }}
            >
              <option value="" disabled>
                Selecione um programa
              </option>
              {programOptions.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
              <option value={NEW_PROGRAM_VALUE}>+ Novo programa…</option>
            </Select>

            {creatingProgram ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <TextInput
                  autoFocus
                  placeholder="Nome do novo programa"
                  value={newProgramName}
                  onChange={(event) => setNewProgramName(event.target.value)}
                />
                <Button type="button" small loading={creatingBusy} onClick={() => void handleCreateProgram()}>
                  Criar
                </Button>
                <Button
                  type="button"
                  small
                  variant="ghost"
                  onClick={() => {
                    setCreatingProgram(false);
                    setNewProgramName('');
                    setProgramError(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : null}
          </Field>

          <Field label="Responsável" htmlFor="owner" hint="Quem responde pelo projeto na organização.">
            <Select
              id="owner"
              value={form.ownerVolunteerId}
              onChange={(event) => update('ownerVolunteerId', event.target.value)}
            >
              <option value="">Sem responsável definido</option>
              {volunteers.map((volunteer) => (
                <option key={volunteer.id} value={volunteer.id}>
                  {volunteer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descrição" htmlFor="description" span hint="O que será feito, em poucas linhas.">
            <TextArea
              id="description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </Field>

          <Field label="Objetivo" htmlFor="objective" span hint="O resultado que o projeto quer alcançar.">
            <TextArea id="objective" value={form.objective} onChange={(event) => update('objective', event.target.value)} />
          </Field>

          <Field label="Comunidade ou beneficiários" htmlFor="beneficiaries">
            <TextInput
              id="beneficiaries"
              value={form.beneficiaries}
              placeholder="Ex.: Associação de Moradores do Jardim Semear"
              onChange={(event) => update('beneficiaries', event.target.value)}
            />
          </Field>

          <Field label="Público beneficiado" htmlFor="targetAudience">
            <TextInput
              id="targetAudience"
              value={form.targetAudience}
              placeholder="Ex.: 30 famílias"
              onChange={(event) => update('targetAudience', event.target.value)}
            />
          </Field>

          <Field label="Endereço" htmlFor="address" span>
            <TextInput
              id="address"
              value={form.address}
              placeholder="Rua, número"
              onChange={(event) => update('address', event.target.value)}
            />
          </Field>

          <Field label="Bairro" htmlFor="district">
            <TextInput id="district" value={form.district} onChange={(event) => update('district', event.target.value)} />
          </Field>

          <Field label="Cidade" htmlFor="city">
            <TextInput id="city" value={form.city} onChange={(event) => update('city', event.target.value)} />
          </Field>

          <Field label="Estado" htmlFor="state">
            <TextInput
              id="state"
              value={form.state}
              maxLength={60}
              placeholder="SP"
              onChange={(event) => update('state', event.target.value)}
            />
          </Field>

          <Field
            label="Coordenadas"
            htmlFor="latitude"
            hint="Opcional. Usadas para exibir o mapa do projeto."
            error={errors.latitude ?? errors.longitude}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <TextInput
                id="latitude"
                value={form.latitude}
                placeholder="Latitude"
                invalid={Boolean(errors.latitude)}
                onChange={(event) => update('latitude', event.target.value)}
              />
              <TextInput
                id="longitude"
                value={form.longitude}
                placeholder="Longitude"
                invalid={Boolean(errors.longitude)}
                onChange={(event) => update('longitude', event.target.value)}
              />
            </div>
          </Field>

          <Field label="Data de início" htmlFor="startDate" required error={errors.startDate}>
            <TextInput
              id="startDate"
              type="date"
              value={form.startDate}
              invalid={Boolean(errors.startDate)}
              onChange={(event) => update('startDate', event.target.value)}
            />
          </Field>

          <Field label="Previsão de término" htmlFor="endDateForecast" error={errors.endDateForecast}>
            <TextInput
              id="endDateForecast"
              type="date"
              value={form.endDateForecast}
              invalid={Boolean(errors.endDateForecast)}
              onChange={(event) => update('endDateForecast', event.target.value)}
            />
          </Field>

          <Field label="Status" htmlFor="status" required>
            <Select
              id="status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {projectStatusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Progresso (%)" htmlFor="progress" error={errors.progress}>
            <TextInput
              id="progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              invalid={Boolean(errors.progress)}
              onChange={(event) => update('progress', event.target.value)}
            />
          </Field>

          <Field label="Observações" htmlFor="notes" span>
            <TextArea id="notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
