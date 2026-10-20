import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { activitiesApi, volunteersApi } from '../../api/endpoints';
import type {
  Activity,
  ActivityPriority,
  ActivityStatus,
  ProjectVolunteer,
  SaveActivityPayload,
  Volunteer
} from '../../types/api';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  SENSITIVE_DATA_HINT,
  activityStatusLabel,
  emptyToNull,
  priorityLabel
} from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import { ActivityExtras } from './ActivityExtras';

interface ActivityFormModalProps {
  /** Projeto da atividade; vazio quando ele e escolhido no proprio formulario (ver `projects`). */
  projectId: string;
  /** Com esta lista, uma atividade nova ganha o campo "Projeto" (criada fora da pagina do projeto). */
  projects?: Array<{ id: string; name: string }>;
  activity: Activity | null;
  /** Equipe do projeto: primeira opcao para atribuir a atividade. Sem ela, o formulario busca a equipe. */
  team?: ProjectVolunteer[];
  /** Voluntarios ativos da organizacao. Quem estiver fora da equipe entra nela ao salvar. */
  volunteers: Volunteer[];
  onClose: () => void;
  onSaved: () => void;
  /** Checklist ou anexos mudaram (chamado ao fechar): quem abriu atualiza os contadores. */
  onExtrasChanged?: () => void;
}

export function ActivityFormModal({
  projectId,
  projects,
  activity,
  team,
  volunteers,
  onClose,
  onSaved,
  onExtrasChanged
}: ActivityFormModalProps) {
  // Checklist e anexos gravam na hora; ao fechar sem salvar, quem abriu ainda precisa saber.
  const extrasChanged = useRef(false);
  function close() {
    if (extrasChanged.current) onExtrasChanged?.();
    onClose();
  }

  const chooseProject = !activity && Boolean(projects);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [title, setTitle] = useState(activity?.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [assignedVolunteerId, setAssignedVolunteerId] = useState(activity?.assignedVolunteerId ?? '');
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'AFazer');
  const [priority, setPriority] = useState<ActivityPriority>(activity?.priority ?? 'Media');
  const [dueDate, setDueDate] = useState(activity?.dueDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [blockedReason, setBlockedReason] = useState(activity?.blockedReason ?? '');

  // Aberto fora da pagina do projeto (quadro de atividades), a equipe vem da API.
  const [loadedTeam, setLoadedTeam] = useState<ProjectVolunteer[] | null>(null);
  useEffect(() => {
    if (team) return;
    if (!selectedProjectId) {
      setLoadedTeam([]);
      return;
    }
    let active = true;
    setLoadedTeam(null);
    volunteersApi
      .listByProject(selectedProjectId)
      .then((list) => active && setLoadedTeam(list))
      .catch(() => active && setLoadedTeam([]));
    return () => {
      active = false;
    };
  }, [team, selectedProjectId]);

  const teamLoading = !team && loadedTeam === null;
  const currentTeam = team ?? loadedTeam ?? [];
  const teamIds = new Set(currentTeam.map((member) => member.volunteerId));
  const others = volunteers.filter((volunteer) => !teamIds.has(volunteer.id));
  const outsiderSelected = !teamLoading && Boolean(assignedVolunteerId) && !teamIds.has(assignedVolunteerId);

  const [projectError, setProjectError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const missingProject = chooseProject && !selectedProjectId;
    const shortTitle = title.trim().length < 3;
    setProjectError(missingProject ? 'Selecione o projeto da atividade.' : null);
    setTitleError(shortTitle ? 'Informe um título com ao menos 3 caracteres.' : null);
    if (missingProject || shortTitle) return;

    const payload: SaveActivityPayload = {
      title: title.trim(),
      description: emptyToNull(description),
      assignedVolunteerId: assignedVolunteerId || null,
      status,
      priority,
      dueDate: dueDate || null,
      notes: emptyToNull(notes),
      blockedReason: status === 'Bloqueada' ? emptyToNull(blockedReason) : null
    };

    setSaving(true);
    try {
      if (activity) await activitiesApi.update(activity.id, payload);
      else await activitiesApi.create(selectedProjectId, payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar a atividade.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={activity ? 'Editar atividade' : 'Nova atividade'}
      subtitle={
        activity
          ? 'Checklist e anexos são gravados na hora; os demais campos, ao salvar.'
          : 'Atividades organizam a execução do projeto no dia a dia.'
      }
      size={activity ? 'wide' : 'default'}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            {activity ? 'Salvar alterações' : 'Criar atividade'}
          </Button>
        </>
      }
    >
      <div className={activity ? 'activity-modal' : undefined}>
        <form onSubmit={handleSubmit}>
          {formError ? (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{formError}</Alert>
            </div>
          ) : null}

          <div className="form-grid">
            {chooseProject ? (
              <Field label="Projeto" htmlFor="activity-project" required error={projectError ?? undefined} span>
                <Select
                  id="activity-project"
                  autoFocus={!projectId}
                  value={selectedProjectId}
                  invalid={Boolean(projectError)}
                  onChange={(event) => {
                    setSelectedProjectId(event.target.value);
                    setProjectError(null);
                  }}
                >
                  <option value="">Selecione o projeto</option>
                  {projects!.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Título" htmlFor="activity-title" required error={titleError ?? undefined} span>
              <TextInput
                id="activity-title"
                autoFocus={!activity && !(chooseProject && !projectId)}
                value={title}
                invalid={Boolean(titleError)}
                placeholder="Ex.: Refazer instalação elétrica da casa 2"
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleError(null);
                }}
              />
            </Field>

            <Field
              label="Responsável"
              htmlFor="activity-owner"
              hint={
                !selectedProjectId
                  ? 'Escolha o projeto primeiro.'
                  : outsiderSelected
                    ? 'Esta pessoa ainda não está na equipe e será adicionada a ela ao salvar.'
                    : undefined
              }
            >
              <Select
                id="activity-owner"
                value={assignedVolunteerId}
                disabled={teamLoading || !selectedProjectId}
                onChange={(event) => setAssignedVolunteerId(event.target.value)}
              >
                <option value="">Sem responsável</option>
                <optgroup label="Equipe do projeto">
                  {currentTeam.map((member) => (
                    <option key={member.volunteerId} value={member.volunteerId}>
                      {member.name}
                    </option>
                  ))}
                </optgroup>
                {others.length > 0 ? (
                  <optgroup label="Outros voluntários (entram na equipe)">
                    {others.map((volunteer) => (
                      <option key={volunteer.id} value={volunteer.id}>
                        {volunteer.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </Field>

            <Field label="Prazo" htmlFor="activity-due">
              <TextInput
                id="activity-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>

            <Field label="Prioridade" htmlFor="activity-priority" required>
              <Select
                id="activity-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as ActivityPriority)}
              >
                {ACTIVITY_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {priorityLabel(value)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Atividade nova sempre comeca sem iniciar; o status so aparece ao editar. */}
            {activity ? (
              <Field label="Status" htmlFor="activity-status" required>
                <Select
                  id="activity-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ActivityStatus)}
                >
                  {ACTIVITY_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {activityStatusLabel(value)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {status === 'Bloqueada' ? (
              <Field label="O que está travando?" htmlFor="activity-blocked" span hint="Opcional. Aparece no card e no Precisa de atenção.">
                <TextInput
                  id="activity-blocked"
                  maxLength={300}
                  value={blockedReason}
                  placeholder="Ex.: aguardando a doação do material"
                  onChange={(event) => setBlockedReason(event.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Descrição" htmlFor="activity-description" span hint="O que precisa ser feito, em poucas linhas.">
              <TextArea
                id="activity-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <Field label="Observações" htmlFor="activity-notes" span hint={SENSITIVE_DATA_HINT}>
              <TextArea id="activity-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>

          <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
        </form>

        {/* Atividade ja criada: checklist e anexos ao lado do formulario (embaixo, no celular). */}
        {activity ? (
          <ActivityExtras activity={activity} onChanged={() => (extrasChanged.current = true)} />
        ) : null}
      </div>
    </Modal>
  );
}
