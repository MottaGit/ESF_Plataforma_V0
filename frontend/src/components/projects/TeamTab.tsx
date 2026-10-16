import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { volunteersApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProjectDetail, ProjectVolunteer, Volunteer } from '../../types/api';
import { formatDate, sectorLabel } from '../../utils/format';
import { LateBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface TeamTabProps {
  project: ProjectDetail;
  onChanged: () => void;
}

/** Equipe do projeto: quem participa, o papel de cada um e quanto trabalho tem em aberto. */
export function TeamTab({ project, onChanged }: TeamTabProps) {
  const { notify, notifyError } = useToast();
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [removing, setRemoving] = useState<ProjectVolunteer | null>(null);
  const [busy, setBusy] = useState(false);

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
          Quem participa do projeto e o papel de cada um. O responsável pelo projeto e quem recebe uma atividade entram
          aqui automaticamente.
        </p>
        <div className="toolbar__right">
          <Link className="btn btn--sm" to="/voluntarios">
            Gerenciar voluntários
          </Link>
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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Voluntário</th>
                  <th>Papel no projeto</th>
                  <th>Atividades</th>
                  <th>Contato</th>
                  <th className="tight">Desde</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {members.map((volunteer) => {
                  const load = workload(volunteer.volunteerId);
                  return (
                    <tr key={volunteer.volunteerId}>
                      <td>
                        <div className="table__primary">{volunteer.name}</div>
                        <div className="table__secondary">{sectorLabel(volunteer.sector)}</div>
                      </td>
                      <td>
                        {volunteer.volunteerId === project.ownerVolunteerId ? (
                          <div style={{ marginBottom: 4 }}>
                            <span className="badge badge--run">Responsável</span>
                          </div>
                        ) : null}
                        {volunteer.roleInProject ?? (volunteer.volunteerId === project.ownerVolunteerId ? null : '—')}
                      </td>
                      <td className="tight">
                        {load.open === 0 ? (
                          <span className="table__secondary">nenhuma em aberto</span>
                        ) : (
                          <>
                            <span className="num">{load.open}</span> em aberto
                            {load.late > 0 ? (
                              <div style={{ marginTop: 4 }}>
                                <LateBadge label={load.late === 1 ? '1 atrasada' : `${load.late} atrasadas`} />
                              </div>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td>
                        {volunteer.email ?? '—'}
                        {volunteer.phone ? <div className="table__secondary">{volunteer.phone}</div> : null}
                      </td>
                      <td className="tight">{formatDate(volunteer.joinedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <Button
                            small
                            variant="ghost"
                            icon={<IconTrash size={15} />}
                            title={
                              volunteer.volunteerId === project.ownerVolunteerId
                                ? 'Responsável pelo projeto: troque o responsável antes de desvincular'
                                : 'Desvincular'
                            }
                            aria-label="Desvincular voluntário"
                            disabled={volunteer.volunteerId === project.ownerVolunteerId}
                            onClick={() => setRemoving(volunteer)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function LinkVolunteerModal({ projectId, available, onClose, onSaved }: LinkVolunteerModalProps) {
  const [volunteerId, setVolunteerId] = useState(available[0]?.id ?? '');
  const [roleInProject, setRoleInProject] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!volunteerId) {
      setFormError('Selecione um voluntário.');
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
      title="Vincular voluntário"
      subtitle="Escolha alguém já cadastrado na organização."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} disabled={available.length === 0} onClick={() => void handleSave()}>
            Vincular
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
          <Field label="Voluntário" htmlFor="link-volunteer" required>
            <Select id="link-volunteer" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
              {available.map((volunteer) => (
                <option key={volunteer.id} value={volunteer.id}>
                  {volunteer.name} — {sectorLabel(volunteer.sector)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Papel no projeto" htmlFor="link-role" hint="Ex.: responsável técnico, oficinas, mobilização.">
            <TextInput
              id="link-role"
              value={roleInProject}
              onChange={(event) => setRoleInProject(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
