import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { volunteersApi } from '../api/endpoints';
import { VolunteerStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { SaveVolunteerPayload, Volunteer, VolunteerSector, VolunteerStatus } from '../types/api';
import {
  VOLUNTEER_SECTORS,
  VOLUNTEER_STATUSES,
  emptyToNull,
  isPastProjectStatus,
  sectorLabel,
  volunteerStatusLabel
} from '../utils/format';

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
          <p className="page-head__desc">Pessoas da organização: setor, situação e em quantos projetos atuam.</p>
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
                  <th>Projetos</th>
                  <th>Situação</th>
                  {canManage ? <th className="right">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {volunteers.map((volunteer) => {
                  const currentProjects = volunteer.projects.filter((item) => !isPastProjectStatus(item.projectStatus));
                  return (
                    <tr key={volunteer.id}>
                      <td>
                        <Link className="row-link" to={`/voluntarios/${volunteer.id}`}>
                          {volunteer.name}
                        </Link>
                      </td>
                      <td>{sectorLabel(volunteer.sector)}</td>
                      <td>
                        {currentProjects.length} projeto{currentProjects.length === 1 ? '' : 's'}
                      </td>
                      <td>
                        <VolunteerStatusBadge status={volunteer.status} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="row-actions">
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
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <VolunteerFormModal
          volunteer={editing}
          onClose={() => setFormOpen(false)}
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
}

export function VolunteerFormModal({ volunteer, onClose, onSaved }: VolunteerFormModalProps) {
  const [name, setName] = useState(volunteer?.name ?? '');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [phone, setPhone] = useState(volunteer?.phone ?? '');
  const [sector, setSector] = useState<VolunteerSector>(volunteer?.sector ?? 'Projetos');
  const [skills, setSkills] = useState(volunteer?.skills ?? '');
  const [notes, setNotes] = useState(volunteer?.notes ?? '');
  const [status, setStatus] = useState<VolunteerStatus>(volunteer?.status ?? 'Ativo');
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
      skills: emptyToNull(skills),
      notes: emptyToNull(notes),
      status
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
      subtitle="Dados básicos de contato, setor e situação na organização."
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

          <Field label="Setor" htmlFor="volunteer-sector" required>
            <Select id="volunteer-sector" value={sector} onChange={(event) => setSector(event.target.value as VolunteerSector)}>
              {VOLUNTEER_SECTORS.map((value) => (
                <option key={value} value={value}>
                  {sectorLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Situação" htmlFor="volunteer-status" required>
            <Select id="volunteer-status" value={status} onChange={(event) => setStatus(event.target.value as VolunteerStatus)}>
              {VOLUNTEER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {volunteerStatusLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Competências" htmlFor="volunteer-skills" span hint="Habilidades relevantes para os projetos.">
            <TextArea id="volunteer-skills" value={skills} onChange={(event) => setSkills(event.target.value)} />
          </Field>

          <Field label="Outras informações relevantes" htmlFor="volunteer-notes" span>
            <TextArea id="volunteer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
