import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { certificatesApi, projectsApi, volunteersApi } from '../api/endpoints';
import { SignedDocumentsPanel } from '../components/documents/SignedDocumentsPanel';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge, VolunteerStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconDownload, IconEdit, IconPlus, IconTrash } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ProjectListItem, Volunteer, VolunteerProject } from '../types/api';
import {
  birthdayLabel,
  emptyToNull,
  isBirthdayToday,
  isPastProjectStatus,
  sectorLabel,
  todayInputValue
} from '../utils/format';
import { VolunteerFormModal } from './VolunteersPage';

export function VolunteerDetailPage() {
  const { id = '' } = useParams();
  const { canManage } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVolunteer(await volunteersApi.get(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o voluntário.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Carregando voluntário…" />;

  if (error || !volunteer) {
    return (
      <>
        <Alert kind="error">{error ?? 'Voluntário não encontrado.'}</Alert>
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/voluntarios')}>Voltar para voluntários</Button>
        </div>
      </>
    );
  }

  const current = volunteer.projects.filter((item) => !isPastProjectStatus(item.projectStatus));
  const history = volunteer.projects.filter((item) => isPastProjectStatus(item.projectStatus));

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to="/voluntarios" className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          Voluntários
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text person-head">
          <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={64} />
          <div>
            <h1>{volunteer.name}</h1>
            <p className="page-head__desc">{sectorLabel(volunteer.sector)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <VolunteerStatusBadge status={volunteer.status} />
              {isBirthdayToday(volunteer.birthDay, volunteer.birthMonth) ? <BirthdayBadge /> : null}
            </div>
          </div>
        </div>

        {canManage && !volunteer.anonymized ? (
          <div className="page-head__actions">
            <Button icon={<IconDownload size={15} />} onClick={() => setCertificateOpen(true)}>
              Gerar certificado
            </Button>
            <Button variant="primary" icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
              Editar voluntário
            </Button>
          </div>
        ) : null}
      </div>

      {volunteer.anonymized ? (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="info">
            Os dados pessoais deste voluntário foram anonimizados. O histórico de projetos e atividades continua, sem
            identificar a pessoa.
          </Alert>
        </div>
      ) : null}

      <div className="grid-sidebar">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel__head">
              <h2>Informações pessoais</h2>
            </div>
            <div className="panel__body">
              <div className="meta-list">
                <div>
                  <div className="meta__label">Nome</div>
                  <div className="meta__value">{volunteer.name}</div>
                </div>
                <div>
                  <div className="meta__label">E-mail</div>
                  <div className="meta__value">{volunteer.email ?? '—'}</div>
                </div>
                <div>
                  <div className="meta__label">Telefone</div>
                  <div className="meta__value">{volunteer.phone ?? '—'}</div>
                </div>
                <div>
                  <div className="meta__label">Aniversário</div>
                  <div className="meta__value">{birthdayLabel(volunteer.birthDay, volunteer.birthMonth) ?? '—'}</div>
                </div>
                <div>
                  <div className="meta__label">Setor</div>
                  <div className="meta__value">{sectorLabel(volunteer.sector)}</div>
                </div>
                <div>
                  <div className="meta__label">Situação</div>
                  <div className="meta__value">
                    <VolunteerStatusBadge status={volunteer.status} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Perfil</h2>
            </div>
            <div className="panel__body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div className="meta__label">Competências</div>
                  <p className="meta__value">{volunteer.skills ?? 'Nada registrado.'}</p>
                </div>
                <div>
                  <div className="meta__label">Outras informações relevantes</div>
                  <p className="meta__value">{volunteer.notes ?? 'Nada registrado.'}</p>
                </div>
              </div>
            </div>
          </section>

          {canManage ? (
            <SignedDocumentsPanel
              owner={{ type: 'volunteer', id: volunteer.id }}
              title="Termo de adesão e uso de imagem"
              description="Exigido pela Lei do Voluntariado (9.608/98). Gere o termo com os dados do voluntário, colha a assinatura e envie a cópia assinada."
              templateLabel="Gerar termo para assinar"
              onChanged={() => void load()}
            />
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <ProjectsPanel
            title="Projetos atuais"
            items={current}
            emptyText="Nenhum projeto em andamento no momento."
            volunteerId={volunteer.id}
            linkedProjectIds={volunteer.projects.map((item) => item.projectId)}
            canManage={canManage}
            allowLinking
            onChanged={() => void load()}
          />

          <ProjectsPanel
            title="Histórico"
            items={history}
            emptyText="Sem projetos concluídos ou cancelados ainda."
            volunteerId={volunteer.id}
            linkedProjectIds={volunteer.projects.map((item) => item.projectId)}
            canManage={canManage}
            onChanged={() => void load()}
          />
        </div>
      </div>

      {certificateOpen ? (
        <CertificateModal volunteer={volunteer} onClose={() => setCertificateOpen(false)} />
      ) : null}

      {editing ? (
        <VolunteerFormModal
          volunteer={volunteer}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notify('Voluntário atualizado.');
            void load();
          }}
        />
      ) : null}
    </>
  );
}

interface ProjectsPanelProps {
  title: string;
  items: VolunteerProject[];
  emptyText: string;
  volunteerId: string;
  linkedProjectIds: string[];
  canManage: boolean;
  allowLinking?: boolean;
  onChanged: () => void;
}

function ProjectsPanel({
  title,
  items,
  emptyText,
  volunteerId,
  linkedProjectIds,
  canManage,
  allowLinking,
  onChanged
}: ProjectsPanelProps) {
  const { notify, notifyError } = useToast();
  const [linkOpen, setLinkOpen] = useState(false);
  const [removing, setRemoving] = useState<VolunteerProject | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUnlink() {
    if (!removing) return;
    setBusy(true);
    try {
      await volunteersApi.removeFromProject(removing.projectId, volunteerId);
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
    <section className="panel">
      <div className="panel__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{title}</h2>
        {allowLinking && canManage ? (
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setLinkOpen(true)}>
            Vincular a um projeto
          </Button>
        ) : null}
      </div>
      <div className="panel__body">
        {items.length === 0 ? (
          <EmptyState title={emptyText} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Função</th>
                  {canManage ? <th className="right">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.projectId}>
                    <td>
                      <Link className="row-link" to={`/projetos/${item.projectId}`}>
                        {item.projectName}
                      </Link>
                    </td>
                    <td>{item.roleInProject ?? '—'}</td>
                    {canManage ? (
                      <td>
                        <div className="row-actions">
                          <Button
                            small
                            variant="ghost"
                            icon={<IconTrash size={15} />}
                            title="Desvincular"
                            aria-label={`Desvincular de ${item.projectName}`}
                            onClick={() => setRemoving(item)}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {linkOpen ? (
        <LinkProjectModal
          volunteerId={volunteerId}
          linkedProjectIds={linkedProjectIds}
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
          message={`O voluntário deixará de constar na equipe de "${removing.projectName}".`}
          confirmLabel="Desvincular"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleUnlink()}
        />
      ) : null}
    </section>
  );
}

interface LinkProjectModalProps {
  volunteerId: string;
  linkedProjectIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

function LinkProjectModal({ volunteerId, linkedProjectIds, onClose, onSaved }: LinkProjectModalProps) {
  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [roleInProject, setRoleInProject] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectsApi.list({ sort: 'name' }).then(setAllProjects).catch(() => undefined);
  }, []);

  const available = useMemo(
    () => allProjects.filter((project) => !linkedProjectIds.includes(project.id)),
    [allProjects, linkedProjectIds]
  );

  useEffect(() => {
    if (!projectId && available.length > 0) setProjectId(available[0].id);
  }, [available, projectId]);

  async function handleSave() {
    if (!projectId) {
      setFormError('Selecione um projeto.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await volunteersApi.addToProject(projectId, volunteerId, roleInProject.trim() || null);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível vincular ao projeto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Vincular a um projeto"
      subtitle="Escolha um projeto já cadastrado."
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
        <Alert kind="info">Este voluntário já está vinculado a todos os projetos cadastrados.</Alert>
      ) : (
        <div className="form-grid form-grid--single">
          <Field label="Projeto" htmlFor="link-project" required>
            <Select id="link-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {available.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Função no projeto" htmlFor="link-role" hint="Ex.: responsável técnico, oficinas, mobilização.">
            <TextInput id="link-role" value={roleInProject} onChange={(event) => setRoleInProject(event.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/** Total de horas do certificado: semanas do periodo (contando o primeiro e o ultimo dia) x carga semanal. */
function certificateHours(start: string, end: string, weeklyHours: number) {
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1;
  return days > 0 && weeklyHours > 0 ? Math.floor((days / 7) * weeklyHours) : 0;
}

/**
 * Certificado de participacao no voluntariado: periodo, horas por semana (6 por padrao) e, se quiser, o CPF,
 * que vai so para o PDF e nao fica salvo.
 */
function CertificateModal({ volunteer, onClose }: { volunteer: Volunteer; onClose: () => void }) {
  const today = todayInputValue();
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(today);
  const [weeklyHours, setWeeklyHours] = useState('6');
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const hours = Number(weeklyHours);
  const total = startDate && endDate ? certificateHours(startDate, endDate, hours) : 0;

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (!startDate || !endDate || endDate < startDate) {
      setError('Informe um período válido (o fim não pode ser antes do início).');
      return;
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 60) {
      setError('Informe de 1 a 60 horas por semana.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await certificatesApi.download(volunteer.id, { startDate, endDate, weeklyHours: hours, cpf: emptyToNull(cpf) });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o certificado.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      title="Gerar certificado"
      subtitle={`Certificado de participação no voluntariado de ${volunteer.name}.`}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={generating} onClick={() => void generate()}>
            Gerar PDF
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={generate} className="form-grid">
        <Field label="Início" htmlFor="certificate-start" required>
          <TextInput id="certificate-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Fim" htmlFor="certificate-end" required>
          <TextInput id="certificate-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
        <Field label="Horas por semana" htmlFor="certificate-hours" required hint={`Total no período: ${total} horas.`}>
          <TextInput
            id="certificate-hours"
            type="number"
            min={1}
            max={60}
            value={weeklyHours}
            onChange={(event) => setWeeklyHours(event.target.value)}
          />
        </Field>
        <Field label="CPF" htmlFor="certificate-cpf" hint="Opcional. Só vai para o certificado; não fica salvo.">
          <TextInput id="certificate-cpf" value={cpf} placeholder="000.000.000-00" onChange={(event) => setCpf(event.target.value)} />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
