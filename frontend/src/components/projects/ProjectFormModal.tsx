import { Suspense, lazy, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi, projectsApi } from '../../api/endpoints';
import type { Program, ProjectDetail, ProjectStatus, SaveProjectPayload, Volunteer } from '../../types/api';
import {
  PROJECT_STATUSES,
  SENSITIVE_DATA_HINT,
  emptyToNull,
  projectStatusLabel,
  todayInputValue
} from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconMapPin, IconPlus } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ProgramFormModal } from '../programs/ProgramFormModal';

// O mapa (Leaflet) so e baixado quando alguem vai marcar o local.
const LocationPickerModal = lazy(() =>
  import('../map/LocationPickerModal').then((module) => ({ default: module.LocationPickerModal }))
);

interface ProjectFormModalProps {
  project: ProjectDetail | null;
  /** Projeto novo criado a partir da pagina de um programa: ja vem com ele escolhido. */
  initialProgramId?: string;
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
    status: project?.status ?? 'Planejamento'
  };
}

/** "Cria 5 atividades e 2 indicadores e preenche os textos sugeridos." (null: programa sem modelo) */
function templateDescription(program: Program) {
  const created = [
    program.templateActivitiesCount > 0
      ? `${program.templateActivitiesCount} tarefa${program.templateActivitiesCount === 1 ? '' : 's'}`
      : null,
    program.templateIndicatorsCount > 0
      ? `${program.templateIndicatorsCount} indicador${program.templateIndicatorsCount === 1 ? '' : 'es'}`
      : null
  ].filter(Boolean);
  const parts = [
    created.length > 0 ? `cria ${created.join(' e ')}` : null,
    program.hasTemplateTexts ? 'preenche os textos sugeridos' : null
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const sentence = parts.join(' e ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export function ProjectFormModal({
  project,
  initialProgramId,
  volunteers,
  programs,
  onClose,
  onSaved
}: ProjectFormModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(project, initialProgramId ?? programs[0]?.id ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Programas ativos; ao editar um projeto de programa arquivado, o dele continua na lista.
  const [programOptions, setProgramOptions] = useState<Program[]>(() =>
    project && !programs.some((program) => program.id === project.programId)
      ? [
          ...programs,
          {
            id: project.programId,
            name: `${project.programName} (arquivado)`,
            status: 'Arquivado',
            createdAt: project.createdAt,
            projectsCount: 0,
            activeProjectsCount: 0,
            doneProjectsCount: 0,
            icon: project.programIcon,
            color: project.programColor,
            templateActivitiesCount: 0,
            templateIndicatorsCount: 0,
            hasTemplateTexts: false,
            results: []
          }
        ]
      : programs
  );
  const [creatingProgram, setCreatingProgram] = useState(false);

  // Projeto novo: o modelo do programa escolhido (se houver) vem marcado. O programa e buscado na hora, porque a
  // lista recebida pode ser de antes de o modelo mudar.
  const [useTemplate, setUseTemplate] = useState(true);
  const [chosenProgram, setChosenProgram] = useState<Program | null>(null);
  useEffect(() => {
    if (project || !form.programId) return;
    let active = true;
    programsApi
      .get(form.programId)
      .then((program) => active && setChosenProgram(program))
      .catch(() => active && setChosenProgram(null));
    return () => {
      active = false;
    };
  }, [project, form.programId]);
  const templateParts =
    chosenProgram && chosenProgram.id === form.programId ? templateDescription(chosenProgram) : null;

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
      useTemplate: !project && Boolean(templateParts) && useTemplate
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

  // Projeto novo: so o essencial; o resto se completa depois em Sobre › Editar.
  const quick = !project;

  const [picking, setPicking] = useState(false);
  const marked = Boolean(form.latitude && form.longitude);
  const locationField = (
    <Field label="Localização no mapa" span hint="Aparece no mapa da tela Projetos.">
      <div className="location-field">
        <span className={`location-field__status${marked ? '' : ' location-field__status--empty'}`}>
          <IconMapPin size={15} />
          {marked ? 'Marcada no mapa' : 'Ainda não marcada'}
        </span>
        <Button type="button" small onClick={() => setPicking(true)}>
          {marked ? 'Ajustar no mapa' : 'Marcar no mapa'}
        </Button>
      </div>
    </Field>
  );

  const startDateField = (
    <Field label="Data de início" htmlFor="startDate" required error={errors.startDate}>
      <TextInput
        id="startDate"
        type="date"
        value={form.startDate}
        invalid={Boolean(errors.startDate)}
        onChange={(event) => update('startDate', event.target.value)}
      />
    </Field>
  );

  return (
    <>
      <Modal
        title={project ? 'Editar projeto' : 'Novo projeto'}
        subtitle={project ? project.name : 'Só o essencial agora; descrição, objetivo, público e o resto você completa depois em Sobre.'}
        size="wide"
        onClose={onClose}
        footer={
          <>
            {quick ? <span className="modal__foot-note">Campos com * são obrigatórios.</span> : null}
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

            <Field
              label="Programa"
              htmlFor="program"
              required
              error={errors.programId}
              hint="Para editar programas e modelos, escolha o programa na tela Projetos."
            >
              <div className="select-with-action">
                <Select
                  id="program"
                  value={form.programId}
                  invalid={Boolean(errors.programId)}
                  onChange={(event) => update('programId', event.target.value)}
                >
                  <option value="" disabled>
                    Selecione um programa
                  </option>
                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" small icon={<IconPlus size={14} />} onClick={() => setCreatingProgram(true)}>
                  Novo
                </Button>
              </div>
            </Field>

            {!project && templateParts ? (
              <div className="field span-2 template-choice">
                <label className="checkbox">
                  <input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} />
                  Usar o modelo do programa
                </label>
                <span className="field__hint">{templateParts}</span>
              </div>
            ) : null}

            <Field
              label="Responsável"
              htmlFor="owner"
              hint="Quem responde pelo projeto na organização. Entra automaticamente na equipe."
            >
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

            {quick ? startDateField : null}

            {!quick ? (
              <>
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
              </>
            ) : null}

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
                placeholder="RS"
                onChange={(event) => update('state', event.target.value)}
              />
            </Field>

            {quick ? locationField : null}

            {!quick ? (
              <>
                {locationField}

                {startDateField}

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

                <Field label="Observações" htmlFor="notes" span hint={SENSITIVE_DATA_HINT}>
                  <TextArea id="notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </Field>
              </>
            ) : null}
          </div>

          <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </Modal>

      {picking ? (
        <Suspense fallback={null}>
          <LocationPickerModal
            initial={marked ? { latitude: Number(form.latitude), longitude: Number(form.longitude) } : null}
            address={[form.address, form.district, form.city, form.state].map((part) => part.trim()).filter(Boolean).join(', ')}
            icon={chosenProgram?.icon ?? programOptions.find((program) => program.id === form.programId)?.icon ?? 'pin'}
            color={chosenProgram?.color ?? programOptions.find((program) => program.id === form.programId)?.color ?? 'teal'}
            onClose={() => setPicking(false)}
            onConfirm={(location) => {
              update('latitude', location ? String(location.latitude) : '');
              update('longitude', location ? String(location.longitude) : '');
              setPicking(false);
            }}
          />
        </Suspense>
      ) : null}

      {/* Abre por cima do formulario; o programa criado ja fica escolhido. */}
      {creatingProgram ? (
        <ProgramFormModal
          program={null}
          onClose={() => setCreatingProgram(false)}
          onSaved={(created) => {
            setProgramOptions((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
            update('programId', created.id);
            setCreatingProgram(false);
          }}
        />
      ) : null}
    </>
  );
}
