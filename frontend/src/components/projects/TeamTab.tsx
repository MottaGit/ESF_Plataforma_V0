import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { projectHoursApi, volunteersApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectHours, ProjectVolunteer, Volunteer, VolunteerLoad } from '../../types/api';
import { formatHours, sectorLabel } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconCheck, IconEdit, IconPlus, IconSearch, IconTrash } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { ProjectHoursPanel } from './ProjectHoursPanel';

interface TeamTabProps {
  project: ProjectDetail;
  /** Abre a aba Tarefas filtrada pela pessoa. */
  onOpenTasks: (volunteerId: string) => void;
  onChanged: () => void;
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Equipe do projeto: quem participa (setor ao lado do nome), a funcao de cada um, as tarefas em aberto e as horas
 * lancadas. O contato fica na pagina do voluntario (o nome leva ate ela); mudar a funcao e desvincular ficam no "...".
 */
export function TeamTab({ project, onOpenTasks, onChanged }: TeamTabProps) {
  const { notify, notifyError } = useToast();
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [removing, setRemoving] = useState<ProjectVolunteer | null>(null);
  // Funcao no projeto, editada ali mesmo na linha (Enter ou sair do campo salva; Esc desiste).
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [roleText, setRoleText] = useState('');

  async function saveRole(member: ProjectVolunteer) {
    const text = roleText.trim();
    setEditingRole(null);
    if (text === (member.roleInProject ?? '')) return;
    try {
      await volunteersApi.updateProjectRole(project.id, member.volunteerId, text || null);
      notify('Função no projeto atualizada.');
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível mudar a função.');
    }
  }
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState<ProjectHours | null>(null);

  const projectId = project.id;
  const loadHours = useCallback(() => {
    projectHoursApi
      .list(projectId)
      .then(setHours)
      .catch(() => setHours({ total: 0, people: [], entries: [] }));
  }, [projectId]);

  useEffect(() => {
    loadHours();
  }, [loadHours]);

  const hoursOf = (volunteerId: string) => hours?.people.find((person) => person.volunteerId === volunteerId)?.hours ?? 0;

  useEffect(() => {
    volunteersApi
      .list(undefined, true)
      .then(setAllVolunteers)
      .catch(() => undefined);
  }, [linkOpen]);

  const available = useMemo(() => {
    const linked = new Set(project.volunteers.map((item) => item.volunteerId));
    return allVolunteers.filter((volunteer) => !linked.has(volunteer.id));
  }, [allVolunteers, project.volunteers]);

  // Responsavel pelo projeto primeiro; o restante ja vem em ordem alfabetica.
  const members = useMemo(
    () =>
      [...project.volunteers].sort((a, b) =>
        a.volunteerId === project.ownerVolunteerId ? -1 : b.volunteerId === project.ownerVolunteerId ? 1 : 0
      ),
    [project.volunteers, project.ownerVolunteerId]
  );

  function workload(volunteerId: string) {
    const open = project.activities.filter(
      (activity) => activity.assignedVolunteerId === volunteerId && activity.status !== 'Concluida'
    );
    return { open: open.length, late: open.filter((activity) => activity.isLate).length };
  }

  function startEditingRole(member: ProjectVolunteer) {
    setRoleText(member.roleInProject ?? '');
    setEditingRole(member.volunteerId);
  }

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await volunteersApi.removeFromProject(project.id, removing.volunteerId);
      notify('Voluntário desvinculado do projeto.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível desvincular o voluntário.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 560 }}>
          Quem participa do projeto e a função de cada um. O responsável pelo projeto e quem recebe uma tarefa entram
          aqui automaticamente.
        </p>
        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setLinkOpen(true)}>
            Vincular voluntário
          </Button>
        </div>
      </div>

      <div className="panel">
        {project.volunteers.length === 0 ? (
          <EmptyState
            title="Nenhum voluntário vinculado"
            description="Vincule quem participa deste projeto para registrar a equipe envolvida."
            action={
              <Button variant="primary" onClick={() => setLinkOpen(true)}>
                Vincular voluntário
              </Button>
            }
          />
        ) : (
          <ul className="team-list">
            {members.map((member) => {
              const load = workload(member.volunteerId);
              const memberHours = hoursOf(member.volunteerId);
              const isOwner = member.volunteerId === project.ownerVolunteerId;
              const roleLine = [isOwner ? 'Responsável' : null, member.roleInProject].filter(Boolean).join(' · ');
              return (
                <li key={member.volunteerId} className="team-list__item">
                  <Avatar name={member.name} photoUrl={member.photoUrl} size={32} />
                  <div className="team-list__main">
                    <div className="team-list__name">
                      <Link to={`/voluntarios/${member.volunteerId}`}>{member.name}</Link>
                      <span className="team-list__sector">{sectorLabel(member.sector)}</span>
                    </div>
                    {editingRole === member.volunteerId ? (
                      <form
                        className="team-role__form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveRole(member);
                        }}
                      >
                        <TextInput
                          autoFocus
                          value={roleText}
                          maxLength={120}
                          placeholder="Função no projeto. Ex.: compras, projeto elétrico"
                          aria-label={`Função de ${member.name} no projeto`}
                          onChange={(event) => setRoleText(event.target.value)}
                          onBlur={() => void saveRole(member)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setEditingRole(null);
                            }
                          }}
                        />
                      </form>
                    ) : roleLine ? (
                      <div className="team-list__role">{roleLine}</div>
                    ) : null}
                  </div>
                  <div className={`team-list__meta${load.open === 0 && memberHours === 0 ? ' team-list__meta--empty' : ''}`}>
                    <span className={`team-list__tasks${load.open === 0 ? ' is-empty' : ''}`}>
                      {load.open === 0 ? (
                        <span className="team-list__none" title="Nenhuma tarefa em aberto">
                          —
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="team-list__tasks-link"
                            title={`Ver as tarefas de ${member.name}`}
                            onClick={() => onOpenTasks(member.volunteerId)}
                          >
                            {plural(load.open, 'tarefa', 'tarefas')}
                          </button>
                          {load.late > 0 ? (
                            <span className="team-list__late"> · {plural(load.late, 'atrasada', 'atrasadas')}</span>
                          ) : null}
                        </>
                      )}
                    </span>
                    <span
                      className={`team-list__hours num${memberHours === 0 ? ' is-empty' : ''}`}
                      title="Horas lançadas no projeto"
                    >
                      {memberHours > 0 ? formatHours(memberHours) : <span className="team-list__none">—</span>}
                    </span>
                  </div>
                  <Menu
                    label={`Ações para ${member.name}`}
                    items={[
                      {
                        label: member.roleInProject ? 'Mudar função' : 'Definir função',
                        icon: <IconEdit size={14} />,
                        onSelect: () => startEditingRole(member)
                      },
                      {
                        label: 'Desvincular',
                        icon: <IconTrash size={14} />,
                        danger: true,
                        onSelect: () =>
                          isOwner
                            ? notifyError(
                                `${member.name} é responsável pelo projeto: escolha outro responsável em Editar projeto antes de desvincular.`
                              )
                            : setRemoving(member)
                      }
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ProjectHoursPanel project={project} hours={hours} onChanged={loadHours} />

      {linkOpen ? (
        <LinkVolunteerModal
          projectId={project.id}
          available={available}
          onClose={() => setLinkOpen(false)}
          onSaved={() => {
            setLinkOpen(false);
            notify('Voluntário vinculado ao projeto.');
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Desvincular voluntário"
          message={`${removing.name} deixará de constar na equipe deste projeto. O cadastro do voluntário continua na organização.`}
          confirmLabel="Desvincular"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
        />
      ) : null}
    </>
  );
}

interface LinkVolunteerModalProps {
  projectId: string;
  available: Volunteer[];
  onClose: () => void;
  onSaved: () => void;
}

/** A partir de quantas pessoas disponiveis a janela mostra a busca. */
const SEARCH_FROM = 7;

/**
 * Escolha de quem entra na equipe: lista com foto, nome e, embaixo, setor e tarefas em aberto (em todos os projetos),
 * para ver quem esta livre. Busca pelo nome ou pelo setor, sem diferenciar acentos.
 */
function LinkVolunteerModal({ projectId, available, onClose, onSaved }: LinkVolunteerModalProps) {
  const [volunteerId, setVolunteerId] = useState('');
  const [query, setQuery] = useState('');
  const [roleInProject, setRoleInProject] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [load, setLoad] = useState<Map<string, VolunteerLoad>>(new Map());

  useEffect(() => {
    volunteersApi
      .load()
      .then((list) => setLoad(new Map(list.map((item) => [item.volunteerId, item]))))
      .catch(() => undefined);
  }, []);

  const term = fold(query.trim());
  const shown = term
    ? available.filter((volunteer) => fold(`${volunteer.name} ${sectorLabel(volunteer.sector)}`).includes(term))
    : available;
  const chosen = available.find((volunteer) => volunteer.id === volunteerId);

  async function handleSave() {
    if (!volunteerId) {
      setFormError('Escolha quem vai entrar na equipe.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await volunteersApi.addToProject(projectId, volunteerId, roleInProject.trim() || null);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível vincular o voluntário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title="Vincular voluntário"
      subtitle="Escolha alguém já cadastrado na organização."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} disabled={available.length === 0} onClick={() => void handleSave()}>
            {chosen ? `Vincular ${chosen.name.split(' ')[0]}` : 'Vincular'}
          </Button>
        </>
      }
    >
      {formError ? (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{formError}</Alert>
        </div>
      ) : null}

      {available.length === 0 ? (
        <Alert kind="info">
          Todos os voluntários ativos já estão vinculados a este projeto. Cadastre novos voluntários na área de
          voluntários.
        </Alert>
      ) : (
        <div className="form-grid form-grid--single">
          {available.length >= SEARCH_FROM ? (
            <span className="search volunteer-pick__search">
              <IconSearch className="search__icon" />
              <TextInput
                type="search"
                value={query}
                placeholder="Buscar pelo nome ou setor"
                aria-label="Buscar voluntário"
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          ) : null}

          <div className="volunteer-pick" role="radiogroup" aria-label="Voluntário">
            {shown.length === 0 ? <p className="field__hint">Ninguém encontrado com essa busca.</p> : null}
            {shown.map((volunteer) => {
              const open = load.get(volunteer.id)?.openActivities ?? 0;
              const selected = volunteer.id === volunteerId;
              return (
                <label key={volunteer.id} className={`volunteer-pick__item${selected ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="link-volunteer"
                    className="sr-only"
                    value={volunteer.id}
                    checked={selected}
                    onChange={() => {
                      setVolunteerId(volunteer.id);
                      setFormError(null);
                    }}
                  />
                  <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={32} />
                  <span className="volunteer-pick__text">
                    <span className="volunteer-pick__name">{volunteer.name}</span>
                    <span className="volunteer-pick__meta">
                      {sectorLabel(volunteer.sector)}
                      {open > 0 ? ` · ${plural(open, 'tarefa', 'tarefas')} em aberto` : ''}
                    </span>
                  </span>
                  {selected ? <IconCheck size={16} className="volunteer-pick__check" /> : null}
                </label>
              );
            })}
          </div>

          <Field label="Função no projeto" htmlFor="link-role" hint="Ex.: responsável técnico, oficinas, mobilização.">
            <TextInput
              id="link-role"
              value={roleInProject}
              maxLength={120}
              onChange={(event) => setRoleInProject(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
