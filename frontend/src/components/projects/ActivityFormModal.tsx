import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { activitiesApi, volunteersApi } from '../../api/endpoints';
import type {
  Activity,
  ActivityPriority,
  ActivityStatus,
  ProjectVolunteer,
  SaveActivityPayload,
  Volunteer,
  VolunteerLoad
} from '../../types/api';
import {
  ACTIVITY_STATUSES,
  SENSITIVE_DATA_HINT,
  activityStatusLabel,
  daysFromToday,
  emptyToNull,
  formatDate,
  formatDateTime,
  volunteerStatusLabel
} from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { ActivityStatusSelect, UrgentBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconEdit } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ActivityExtras } from './ActivityExtras';
import { BlockActivityDialog } from './BlockActivityDialog';

/** Nome com a carga ao lado, na lista de responsaveis: "Ana Aumond · 3 em aberto", "Edu Grehs · afastado". */
function ownerOptionLabel(name: string, load: VolunteerLoad | undefined) {
  if (!load) return name;
  const extras = [
    load.status !== 'Ativo' ? volunteerStatusLabel(load.status).toLowerCase() : null,
    load.openActivities > 0 ? `${load.openActivities} em aberto` : null
  ].filter(Boolean);
  return extras.length > 0 ? `${name} · ${extras.join(' · ')}` : name;
}

/** Dica embaixo do campo para o responsavel escolhido: tarefas em aberto, atrasadas e a situacao. */
function ownerLoadHint(load: VolunteerLoad | undefined) {
  if (!load) return null;
  const tasks =
    load.openActivities === 0
      ? 'Nenhuma tarefa em aberto'
      : `${load.openActivities} ${load.openActivities === 1 ? 'tarefa' : 'tarefas'} em aberto` +
        (load.lateActivities > 0
          ? `, ${load.lateActivities} ${load.lateActivities === 1 ? 'atrasada' : 'atrasadas'}`
          : '');
  return load.status === 'Ativo' ? `${tasks}.` : `${tasks}. Situação: ${volunteerStatusLabel(load.status)}.`;
}

interface ActivityFormModalProps {
  /** Projeto da tarefa; vazio quando ele e escolhido no proprio formulario (ver `projects`). */
  projectId: string;
  /** Com esta lista, uma tarefa nova ganha o campo "Projeto" (criada fora da pagina do projeto). */
  projects?: Array<{ id: string; name: string }>;
  activity: Activity | null;
  /** Tarefa existente: abre para ler (padrao) ou ja no formulario de edicao. */
  initialMode?: 'view' | 'edit';
  /** Equipe do projeto: primeira opcao para atribuir a tarefa. Sem ela, o formulario busca a equipe. */
  team?: ProjectVolunteer[];
  /** Voluntarios ativos da organizacao (sem a lista, o formulario busca quando for editar). */
  volunteers?: Volunteer[];
  onClose: () => void;
  onSaved: () => void;
  /** Status, checklist, anexos ou comentarios mudaram (chamado ao fechar): quem abriu atualiza a lista. */
  onExtrasChanged?: () => void;
}

/**
 * Janela da tarefa. Uma tarefa existente abre para ler: status (muda na hora), responsavel, prazo, descricao e, ao
 * lado, checklist, anexos e comentarios; "Editar" troca para o formulario. Tarefa nova abre direto no formulario.
 */
export function ActivityFormModal({
  projectId,
  projects,
  activity,
  initialMode,
  team,
  volunteers,
  onClose,
  onSaved,
  onExtrasChanged
}: ActivityFormModalProps) {
  // Status, checklist, anexos e comentarios gravam na hora; ao fechar sem salvar, quem abriu ainda precisa saber.
  const extrasChanged = useRef(false);
  function close() {
    if (extrasChanged.current) onExtrasChanged?.();
    onClose();
  }

  const openedToRead = Boolean(activity) && initialMode !== 'edit';
  const [mode, setMode] = useState<'view' | 'edit'>(openedToRead ? 'view' : 'edit');
  /** Copia da tarefa que a leitura mostra (o status muda na hora, sem salvar o formulario). */
  const [current, setCurrent] = useState<Activity | null>(activity);
  const [viewError, setViewError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);

  const chooseProject = !activity && Boolean(projects);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [title, setTitle] = useState(activity?.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [assignedVolunteerId, setAssignedVolunteerId] = useState(activity?.assignedVolunteerId ?? '');
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'AFazer');
  const [priority, setPriority] = useState<ActivityPriority>(activity?.priority ?? 'Media');
  const [dueDate, setDueDate] = useState(activity?.dueDate?.slice(0, 10) ?? '');
  const [blockedReason, setBlockedReason] = useState(activity?.blockedReason ?? '');

  // Sem a lista de voluntarios de quem abriu, busca so quando for editar.
  const [loadedVolunteers, setLoadedVolunteers] = useState<Volunteer[] | null>(null);
  useEffect(() => {
    if (volunteers || mode !== 'edit' || loadedVolunteers) return;
    volunteersApi
      .list(undefined, true)
      .then(setLoadedVolunteers)
      .catch(() => setLoadedVolunteers([]));
  }, [volunteers, mode, loadedVolunteers]);
  const allVolunteers = volunteers ?? loadedVolunteers ?? [];

  // Aberto fora da pagina do projeto, a equipe vem da API (so para o formulario).
  const [loadedTeam, setLoadedTeam] = useState<ProjectVolunteer[] | null>(null);
  useEffect(() => {
    if (team || mode !== 'edit') return;
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
  }, [team, selectedProjectId, mode]);

  const teamLoading = !team && loadedTeam === null;
  const currentTeam = team ?? loadedTeam ?? [];
  const teamIds = new Set(currentTeam.map((member) => member.volunteerId));
  const others = allVolunteers.filter((volunteer) => !teamIds.has(volunteer.id));
  const outsiderSelected = !teamLoading && Boolean(assignedVolunteerId) && !teamIds.has(assignedVolunteerId);

  // Carga de cada pessoa (tarefas em aberto e situacao), ao lado do nome na escolha do responsavel.
  const [load, setLoad] = useState<Map<string, VolunteerLoad> | null>(null);
  useEffect(() => {
    if (mode !== 'edit' || load) return;
    volunteersApi
      .load()
      .then((list) => setLoad(new Map(list.map((item) => [item.volunteerId, item]))))
      .catch(() => setLoad(new Map()));
  }, [mode, load]);
  const ownerLoad = assignedVolunteerId ? load?.get(assignedVolunteerId) : undefined;

  const [projectError, setProjectError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    // O formulario parte do que a leitura mostra (o status pode ter mudado na hora).
    if (current) {
      setStatus(current.status);
      setBlockedReason(current.blockedReason ?? '');
    }
    setMode('edit');
  }

  async function changeStatus(next: ActivityStatus, reason: string | null = null) {
    if (!current || next === current.status) return;
    setViewError(null);
    try {
      setCurrent(await activitiesApi.updateStatus(current.id, next, reason));
      extrasChanged.current = true;
    } catch (err) {
      setViewError(err instanceof ApiError ? err.message : 'Não foi possível mudar o status.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const missingProject = chooseProject && !selectedProjectId;
    const shortTitle = title.trim().length < 3;
    setProjectError(missingProject ? 'Selecione o projeto da tarefa.' : null);
    setTitleError(shortTitle ? 'Informe um título com ao menos 3 caracteres.' : null);
    if (missingProject || shortTitle) return;

    const payload: SaveActivityPayload = {
      title: title.trim(),
      description: emptyToNull(description),
      assignedVolunteerId: assignedVolunteerId || null,
      status,
      priority,
      dueDate: dueDate || null,
      blockedReason: status === 'Bloqueada' ? emptyToNull(blockedReason) : null
    };

    setSaving(true);
    try {
      if (activity) await activitiesApi.update(activity.id, payload);
      else await activitiesApi.create(selectedProjectId, payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  // ---------- leitura ----------
  if (mode === 'view' && current) {
    const done = current.status === 'Concluida';
    const late = !done && Boolean(current.dueDate) && daysFromToday(current.dueDate!) < 0;

    return (
      <>
        <Modal
          title={current.title}
          subtitle={current.projectName ?? undefined}
          size="wide"
          onClose={close}
          footer={
            <>
              <Button icon={<IconEdit size={15} />} onClick={startEditing}>
                Editar
              </Button>
              <Button variant="primary" onClick={close}>
                Fechar
              </Button>
            </>
          }
        >
          <div className="activity-modal">
            <div className="task-view">
              {viewError ? <Alert kind="error">{viewError}</Alert> : null}

              <div className="task-view__status">
                <ActivityStatusSelect
                  status={current.status}
                  label="Status da tarefa"
                  onChange={(next) => (next === 'Bloqueada' ? setBlocking(true) : void changeStatus(next))}
                />
                {!done ? <UrgentBadge priority={current.priority} /> : null}
              </div>

              {current.status === 'Bloqueada' && current.blockedReason ? (
                <p className="task-view__blocked">
                  <strong>O que está travando:</strong> {current.blockedReason}
                </p>
              ) : null}

              <dl className="task-view__facts">
                <div>
                  <dt>Responsável</dt>
                  <dd>
                    {current.assignedVolunteerName ? (
                      <span className="task-view__person">
                        <Avatar name={current.assignedVolunteerName} photoUrl={current.assignedVolunteerPhotoUrl} size={22} />
                        {current.assignedVolunteerName}
                      </span>
                    ) : (
                      <span className="task-view__none">Sem responsável</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd className={late ? 'task-view__late' : undefined}>
                    {current.dueDate ? `${formatDate(current.dueDate)}${late ? ' · vencido' : ''}` : 'Sem prazo'}
                  </dd>
                </div>
                <div>
                  <dt>Projeto</dt>
                  <dd>
                    <Link to={`/projetos/${current.projectId}?aba=tarefas`} onClick={close}>
                      {current.projectName ?? 'Abrir o projeto'}
                    </Link>
                  </dd>
                </div>
              </dl>

              <div className="task-view__text">
                <h3>Descrição</h3>
                <p>{current.description ?? 'Sem descrição.'}</p>
              </div>

              <p className="field__hint">
                Criada em {formatDateTime(current.createdAt)}
                {current.completedAt ? ` · concluída em ${formatDateTime(current.completedAt)}` : ''}
              </p>
            </div>

            <ActivityExtras activity={current} onChanged={() => (extrasChanged.current = true)} />
          </div>
        </Modal>

        {blocking ? (
          <BlockActivityDialog
            title={current.title}
            onCancel={() => setBlocking(false)}
            onConfirm={(reason) => {
              setBlocking(false);
              void changeStatus('Bloqueada', reason);
            }}
          />
        ) : null}
      </>
    );
  }

  // ---------- formulario (nova tarefa ou edicao) ----------
  return (
    <Modal
      title={activity ? 'Editar tarefa' : 'Nova tarefa'}
      subtitle={
        activity
          ? 'Checklist, anexos e comentários são gravados na hora; os demais campos, ao salvar.'
          : 'Tarefas organizam a execução do projeto no dia a dia.'
      }
      size={activity ? 'wide' : 'default'}
      onClose={close}
      footer={
        <>
          {/* Aberta para ler, "Cancelar" volta para a leitura; aberta direto na edicao, fecha. */}
          <Button onClick={openedToRead ? () => setMode('view') : close}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={(event) => void handleSubmit(event)}>
            {activity ? 'Salvar alterações' : 'Criar tarefa'}
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
                  : [
                      ownerLoadHint(ownerLoad),
                      outsiderSelected ? 'Esta pessoa ainda não está na equipe e será adicionada a ela ao salvar.' : null
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
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
                      {ownerOptionLabel(member.name, load?.get(member.volunteerId))}
                    </option>
                  ))}
                </optgroup>
                {others.length > 0 ? (
                  <optgroup label="Outros voluntários (entram na equipe)">
                    {others.map((volunteer) => (
                      <option key={volunteer.id} value={volunteer.id}>
                        {ownerOptionLabel(volunteer.name, load?.get(volunteer.id))}
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

            <Field label="Prioridade" hint="A tarefa urgente aparece em destaque nas listas e no quadro.">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={priority === 'Alta'}
                  onChange={(event) => setPriority(event.target.checked ? 'Alta' : 'Media')}
                />
                Urgente
              </label>
            </Field>

            {/* Tarefa nova sempre comeca sem iniciar; o status so aparece ao editar. */}
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
              <Field label="O que está travando?" htmlFor="activity-blocked" span hint="Opcional. Aparece no card e nos atalhos de Tarefas.">
                <TextInput
                  id="activity-blocked"
                  maxLength={300}
                  value={blockedReason}
                  placeholder="Ex.: aguardando a doação do material"
                  onChange={(event) => setBlockedReason(event.target.value)}
                />
              </Field>
            ) : null}

            <Field
              label="Descrição"
              htmlFor="activity-description"
              span
              hint={`O que precisa ser feito, em poucas linhas. ${SENSITIVE_DATA_HINT}`}
            >
              <TextArea
                id="activity-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>

          <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
        </form>

        {/* Tarefa ja criada: checklist, anexos e comentarios ao lado do formulario (embaixo, no celular). */}
        {current ? <ActivityExtras activity={current} onChanged={() => (extrasChanged.current = true)} /> : null}
      </div>
    </Modal>
  );
}
