import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { projectsApi, volunteersApi } from '../api/endpoints';
import { NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ProjectListItem, SaveVolunteerPayload, Volunteer, VolunteerProject, VolunteerSector } from '../types/api';
import { emptyToNull, sectorLabel, VOLUNTEER_SECTORS } from '../utils/format';

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function VolunteersPage() {
  const { canManage } = useAuth();
  const { notify, notifyError } = useToast();

  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<VolunteerSector | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [removing, setRemoving] = useState<Volunteer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVolunteers(await volunteersApi.list(debounced || undefined, onlyActive, sectorFilter || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os voluntários.');
    } finally {
      setLoading(false);
    }
  }, [debounced, onlyActive, sectorFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await volunteersApi.remove(removing.id);
      notify('Voluntário excluído.');
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o voluntário.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Voluntários</h1>
          <p className="page-head__desc">Pessoas da organização: contato, setor, situação e em quais projetos atuam.</p>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Novo voluntário
            </Button>
          </div>
        ) : null}
      </div>

      <div className="toolbar">
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar voluntários"
          />
        </span>

        <Select
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value as VolunteerSector | '')}
          aria-label="Setor"
        >
          <option value="">Todos os setores</option>
          {VOLUNTEER_SECTORS.map((value) => (
            <option key={value} value={value}>
              {sectorLabel(value)}
            </option>
          ))}
        </Select>

        <div className="toolbar__right">
          <label className="checkbox">
            <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
            Só ativos
          </label>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando voluntários…" />
        ) : volunteers.length === 0 ? (
          <EmptyState
            title="Nenhum voluntário cadastrado"
            description="Cadastre as pessoas que participam das ações para vinculá-las aos projetos."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Cadastrar voluntário
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Setor</th>
                  <th>Contato</th>
                  <th>Projetos</th>
                  <th>Observações</th>
                  <th>Situação</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((volunteer) => (
                  <tr key={volunteer.id}>
                    <td>
                      <div className="table__primary">{volunteer.name}</div>
                    </td>
                    <td>{sectorLabel(volunteer.sector)}</td>
                    <td>
                      {volunteer.email ?? '—'}
                      {volunteer.phone ? <div className="table__secondary">{volunteer.phone}</div> : null}
                    </td>
                    <td>
                      {volunteer.projects.length === 0 ? (
                        '—'
                      ) : (
                        <div className="tag-list">
                          {volunteer.projects.map((project) => (
                            <NeutralBadge key={project.projectId}>{project.projectName}</NeutralBadge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {volunteer.notes ? (
                        <span title={volunteer.notes}>{truncate(volunteer.notes, 40)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{volunteer.isActive ? <NeutralBadge>Ativo</NeutralBadge> : <NeutralBadge>Inativo</NeutralBadge>}</td>
                    <td>
                      <div className="row-actions">
                        {canManage ? (
                          <>
                            <Button
                              small
                              variant="ghost"
                              icon={<IconEdit size={15} />}
                              title="Editar voluntário"
                              aria-label="Editar voluntário"
                              onClick={() => {
                                setEditing(volunteer);
                                setFormOpen(true);
                              }}
                            />
                            <Button
                              small
                              variant="ghost"
                              icon={<IconTrash size={15} />}
                              title="Excluir voluntário"
                              aria-label="Excluir voluntário"
                              onClick={() => setRemoving(volunteer)}
                            />
                          </>
                        ) : (
                          <span className="field__hint">Somente leitura</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <VolunteerFormModal
          volunteer={editing}
          onClose={() => setFormOpen(false)}
          onProjectsChanged={() => void load()}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Voluntário atualizado.' : 'Voluntário cadastrado.');
            void load();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir voluntário"
          message={`${removing.name} será removido do cadastro e dos projetos em que está vinculado.`}
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

interface VolunteerFormModalProps {
  volunteer: Volunteer | null;
  onClose: () => void;
  onSaved: () => void;
  onProjectsChanged: () => void;
}

function VolunteerFormModal({ volunteer, onClose, onSaved, onProjectsChanged }: VolunteerFormModalProps) {
  const [name, setName] = useState(volunteer?.name ?? '');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [phone, setPhone] = useState(volunteer?.phone ?? '');
  const [sector, setSector] = useState<VolunteerSector>(volunteer?.sector ?? 'Projetos');
  const [notes, setNotes] = useState(volunteer?.notes ?? '');
  const [isActive, setIsActive] = useState(volunteer?.isActive ?? true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (name.trim().length < 3) {
      setNameError('Informe o nome completo.');
      return;
    }
    setNameError(null);

    const payload: SaveVolunteerPayload = {
      name: name.trim(),
      email: emptyToNull(email),
      phone: emptyToNull(phone),
      sector,
      notes: emptyToNull(notes),
      isActive
    };

    setSaving(true);
    try {
      if (volunteer) await volunteersApi.update(volunteer.id, payload);
      else await volunteersApi.create(payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o voluntário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={volunteer ? 'Editar voluntário' : 'Novo voluntário'}
      subtitle="Dados básicos de contato e setor na organização."
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
          <Field label="Nome" htmlFor="volunteer-name" required error={nameError ?? undefined} span>
            <TextInput
              id="volunteer-name"
              value={name}
              invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="E-mail" htmlFor="volunteer-email">
            <TextInput id="volunteer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>

          <Field label="Telefone" htmlFor="volunteer-phone">
            <TextInput id="volunteer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>

          <Field label="Setor" htmlFor="volunteer-sector" required span>
            <Select id="volunteer-sector" value={sector} onChange={(event) => setSector(event.target.value as VolunteerSector)}>
              {VOLUNTEER_SECTORS.map((value) => (
                <option key={value} value={value}>
                  {sectorLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Observações" htmlFor="volunteer-notes" span>
            <TextArea id="volunteer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>

          <div className="field span-2">
            <label className="checkbox">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Voluntário ativo
            </label>
          </div>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>

      {volunteer ? (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <VolunteerProjectsSection volunteer={volunteer} onChanged={onProjectsChanged} />
        </div>
      ) : null}
    </Modal>
  );
}

interface VolunteerProjectsSectionProps {
  volunteer: Volunteer;
  onChanged: () => void;
}

function VolunteerProjectsSection({ volunteer, onChanged }: VolunteerProjectsSectionProps) {
  const { notifyError } = useToast();
  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);
  const [linked, setLinked] = useState<VolunteerProject[]>(volunteer.projects);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [roleInProject, setRoleInProject] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectsApi.list({ sort: 'name' }).then(setAllProjects).catch(() => undefined);
  }, []);

  const available = useMemo(
    () => allProjects.filter((project) => !linked.some((item) => item.projectId === project.id)),
    [allProjects, linked]
  );

  useEffect(() => {
    if (!selectedProjectId && available.length > 0) setSelectedProjectId(available[0].id);
  }, [available, selectedProjectId]);

  async function handleLink() {
    if (!selectedProjectId) return;
    setBusy(true);
    try {
      await volunteersApi.addToProject(selectedProjectId, volunteer.id, roleInProject.trim() || null);
      const project = allProjects.find((item) => item.id === selectedProjectId);
      setLinked((current) => [
        ...current,
        { projectId: selectedProjectId, projectName: project?.name ?? '', roleInProject: roleInProject.trim() || null }
      ]);
      setRoleInProject('');
      setSelectedProjectId('');
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível vincular o projeto.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink(projectId: string, projectName: string) {
    setBusy(true);
    try {
      await volunteersApi.removeFromProject(projectId, volunteer.id);
      setLinked((current) => current.filter((item) => item.projectId !== projectId));
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : `Não foi possível desvincular de ${projectName}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="field__label" style={{ marginBottom: 8 }}>
        Projetos vinculados
      </div>

      {linked.length === 0 ? (
        <p className="field__hint" style={{ marginBottom: 10 }}>
          Ainda não vinculado a nenhum projeto.
        </p>
      ) : (
        <div className="tag-list" style={{ marginBottom: 10 }}>
          {linked.map((project) => (
            <span key={project.projectId} className="badge badge--neutral" style={{ gap: 6 }}>
              {project.projectName}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleUnlink(project.projectId, project.projectName)}
                aria-label={`Desvincular ${project.projectName}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  padding: 0,
                  display: 'inline-flex'
                }}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {available.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <Select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} aria-label="Projeto">
              {available.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <TextInput
              placeholder="Papel no projeto (opcional)"
              value={roleInProject}
              onChange={(event) => setRoleInProject(event.target.value)}
            />
          </div>
          <Button type="button" small loading={busy} onClick={() => void handleLink()}>
            Vincular
          </Button>
        </div>
      ) : null}
    </div>
  );
}
