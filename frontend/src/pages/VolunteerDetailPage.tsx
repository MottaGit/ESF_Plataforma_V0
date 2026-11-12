import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { projectsApi, volunteersApi } from '../api/endpoints';
import { GrantAccessModal, NewAccessLinkModal } from '../components/access/AccessLinkModals';
import { MyTermPanel } from '../components/documents/MyTermPanel';
import { VolunteerTermPanel } from '../components/documents/VolunteerTermPanel';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge, VolunteerStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconDownload, IconEdit, IconKey, IconPlus, IconTrash } from '../components/ui/Icons';
import { Menu } from '../components/ui/Menu';
import { Modal } from '../components/ui/Modal';
import { EmailLink, PhoneLink } from '../components/volunteers/ContactLinks';
import { CertificateModal } from '../components/volunteers/CertificateModal';
import { VolunteerHoursPanel } from '../components/volunteers/VolunteerHoursPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ProjectListItem, Volunteer, VolunteerHours, VolunteerProject } from '../types/api';
import {
  accessLinkStatus,
  birthdayLabel,
  isBirthdayToday,
  isPastProjectStatus,
  roleLabel,
  sectorLabel
} from '../utils/format';
import { VolunteerFormModal } from './VolunteersPage';
import { useLatestRequest } from '../utils/useLatestRequest';

export function VolunteerDetailPage() {
  const { id = '' } = useParams();
  const { user, canManage, isAdmin } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [hours, setHours] = useState<VolunteerHours | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ir de um voluntario a outro com o anterior ainda carregando: so vale o ultimo aberto.
  const startRequest = useLatestRequest();
  const load = useCallback(async () => {
    const isCurrent = startRequest();
    setError(null);
    try {
      // As horas sao um extra: se falharem, o perfil abre do mesmo jeito.
      const [loaded, loadedHours] = await Promise.all([
        volunteersApi.get(id),
        volunteersApi.hours(id).catch(() => null)
      ]);
      if (!isCurrent()) return;
      setVolunteer(loaded);
      setHours(loadedHours);
    } catch (err) {
      if (isCurrent()) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o voluntário.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [startRequest, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** LGPD: no lugar da exclusao, apaga os dados pessoais e mantem o historico dos projetos. */
  async function handleAnonymize() {
    setBusy(true);
    try {
      await volunteersApi.anonymize(id);
      notify('Dados do voluntário anonimizados.');
      setAnonymizing(false);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível anonimizar o voluntário.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Carregando voluntário…" />;

  if (error || !volunteer) {
    return (
      <>
        <Alert kind="error">{error ?? 'Voluntário não encontrado.'}</Alert>
        <div className="row-actions mt-16 justify-start">
          {error ? <Button onClick={() => void load()}>Tentar de novo</Button> : null}
          <Button onClick={() => navigate('/voluntarios')}>Voltar para voluntários</Button>
        </div>
      </>
    );
  }

  const current = volunteer.projects.filter((item) => !isPastProjectStatus(item.projectStatus));
  const history = volunteer.projects.filter((item) => isPastProjectStatus(item.projectStatus));

  const anonymizeItem = { label: 'Anonimizar dados', danger: true, onSelect: () => setAnonymizing(true) };

  const birthday = birthdayLabel(volunteer.birthDay, volunteer.birthMonth);
  const profileFields = [
    volunteer.email ? { label: 'E-mail', value: <EmailLink email={volunteer.email} /> } : null,
    volunteer.phone ? { label: 'Telefone', value: <PhoneLink phone={volunteer.phone} /> } : null,
    birthday ? { label: 'Aniversário', value: birthday } : null,
    volunteer.skills ? { label: 'Competências', value: volunteer.skills } : null,
    volunteer.notes ? { label: 'Outras informações relevantes', value: volunteer.notes } : null
  ].filter((field) => field !== null);

  return (
    <>
      <div className="mb-12">
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
            {/* "Ativo" e o normal: so a excecao (afastado, inativo) ganha etiqueta; o historico fica em Horas. */}
            {volunteer.status !== 'Ativo' || isBirthdayToday(volunteer.birthDay, volunteer.birthMonth) ? (
              <div className="row row--wrap mt-12">
                <VolunteerStatusBadge status={volunteer.status} onlyException />
                {isBirthdayToday(volunteer.birthDay, volunteer.birthMonth) ? <BirthdayBadge /> : null}
              </div>
            ) : null}
          </div>
        </div>

        {canManage && !volunteer.anonymized ? (
          <div className="page-head__actions">
            <Button className="only-desktop" icon={<IconDownload size={15} />} onClick={() => setCertificateOpen(true)}>
              Gerar certificado
            </Button>
            <Button variant="primary" icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
              Editar voluntário
            </Button>
            {/* Anonimizar e acao rara e sem volta: fica no menu, nunca solta na tela. No celular, o certificado
                tambem vai para o menu, para os botoes caberem numa linha. */}
            <span className="only-desktop">
              <Menu label={`Mais ações de ${volunteer.name}`} items={[anonymizeItem]} />
            </span>
            <span className="only-mobile">
              <Menu
                label={`Mais ações de ${volunteer.name}`}
                items={[
                  { label: 'Gerar certificado', icon: <IconDownload size={14} />, onSelect: () => setCertificateOpen(true) },
                  anonymizeItem
                ]}
              />
            </span>
          </div>
        ) : null}
      </div>

      {volunteer.anonymized ? (
        <div className="mb-16">
          <Alert kind="info">
            Os dados pessoais deste voluntário foram anonimizados. O histórico de projetos e tarefas continua, sem
            identificar a pessoa.
          </Alert>
        </div>
      ) : null}

      <div className="grid-sidebar">
        <div className="detail-col">
          <section className="panel">
            <div className="panel__head">
              <h2>Contato e perfil</h2>
            </div>
            <div className="panel__body">
              {/* So o que foi preenchido; o que falta se completa em "Editar voluntário". */}
              {profileFields.length === 0 ? (
                <p className="meta__value">Nenhum contato ou dado de perfil cadastrado.</p>
              ) : (
                <div className="meta-list">
                  {profileFields.map((field) => (
                    <div key={field.label}>
                      <div className="meta__label">{field.label}</div>
                      <div className="meta__value">{field.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

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

          {history.length > 0 ? (
            <ProjectsPanel
              title="Projetos anteriores"
              items={history}
              emptyText=""
              volunteerId={volunteer.id}
              linkedProjectIds={volunteer.projects.map((item) => item.projectId)}
              canManage={canManage}
              onChanged={() => void load()}
            />
          ) : null}
        </div>

        {/* Parte administrativa: acesso, horas e documentos. */}
        <div className="detail-col">
          {canManage && !volunteer.anonymized ? (
            <AccessPanel volunteer={volunteer} isAdmin={isAdmin} onChanged={() => void load()} />
          ) : null}

          {hours ? (
            <VolunteerHoursPanel
              volunteerId={volunteer.id}
              hours={hours}
              canEdit={canManage && !volunteer.anonymized}
              onChanged={() => void load()}
            />
          ) : null}

          {/* No proprio perfil (qualquer perfil de acesso), o botao de assinar; nos outros, a coordenacao so ve e baixa. */}
          {user?.volunteerId === volunteer.id ? (
            <MyTermPanel volunteerId={volunteer.id} onSigned={() => void load()} />
          ) : canManage ? (
            <VolunteerTermPanel volunteer={volunteer} />
          ) : null}
        </div>
      </div>

      {certificateOpen ? (
        <CertificateModal volunteer={volunteer} onClose={() => setCertificateOpen(false)} />
      ) : null}

      {anonymizing ? (
        <ConfirmDialog
          title="Anonimizar voluntário"
          message={`Os dados pessoais de ${volunteer.name} (nome, contatos, aniversário, foto e observações) serão apagados de vez. O histórico de projetos e tarefas continua, como "Voluntário removido", e os documentos assinados ficam guardados. Use quando a pessoa sair da organização ou pedir a exclusão dos dados. Não dá para desfazer.`}
          confirmLabel="Anonimizar"
          destructive
          busy={busy}
          onCancel={() => setAnonymizing(false)}
          onConfirm={() => void handleAnonymize()}
        />
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

/**
 * Acesso a plataforma do voluntario (so a coordenacao ve): da o acesso (link de primeiro acesso) ou gera um link novo
 * para quem perdeu o anterior ou esqueceu a senha. O link novo de um administrador so outro administrador gera.
 */
function AccessPanel({ volunteer, isAdmin, onChanged }: { volunteer: Volunteer; isAdmin: boolean; onChanged: () => void }) {
  const [granting, setGranting] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const access = volunteer.access;
  const canRenew = Boolean(access?.isActive) && (isAdmin || access?.role !== 'Administrador');

  return (
    <section className="panel">
      <div className="panel__head row-between">
        <h2>Acesso à plataforma</h2>
        {!access ? (
          <Button variant="primary" small icon={<IconKey size={15} />} onClick={() => setGranting(true)}>
            Dar acesso
          </Button>
        ) : null}
        {canRenew ? (
          <Button small icon={<IconKey size={15} />} onClick={() => setRenewing(true)}>
            Gerar link de acesso
          </Button>
        ) : null}
      </div>
      <div className="panel__body">
        {!access ? (
          <p className="meta__value">
            Sem acesso. {volunteer.email ? 'O login será o e-mail do cadastro.' : 'Para dar acesso, cadastre antes o e-mail (é o login).'}
          </p>
        ) : (
          // "Ativo" ja e a situacao do voluntario: aqui o acesso diz o que acontece com o login.
          <div className="meta-list">
            <div>
              <div className="meta__label">Perfil de acesso</div>
              <div className="meta__value">{roleLabel(access.role)}</div>
            </div>
            <div>
              <div className="meta__label">Login</div>
              <div className="meta__value">
                {!access.isActive
                  ? `Desativado (${isAdmin ? 'reative' : 'um administrador reativa'} em Configurações › Acessos)`
                  : access.pending
                    ? `Aguardando o primeiro acesso: ${accessLinkStatus(access.linkExpiresAt)}`
                    : 'Liberado: entra com o e-mail e a própria senha'}
                {access.isActive && !canRenew ? (
                  <div className="field__hint">Link novo para um administrador: só outro administrador gera.</div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {granting ? (
        <GrantAccessModal volunteer={volunteer} onClose={() => setGranting(false)} onGranted={onChanged} />
      ) : null}
      {renewing && access ? (
        <NewAccessLinkModal
          userId={access.userId}
          recipient={volunteer}
          firstAccess={access.pending}
          onClose={() => setRenewing(false)}
        />
      ) : null}
    </section>
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
      <div className="panel__head row-between">
        <h2>{title}</h2>
        {allowLinking && canManage ? (
          <Button small icon={<IconPlus size={15} />} onClick={() => setLinkOpen(true)}>
            Vincular a um projeto
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="panel__body">
          <EmptyState title={emptyText} />
        </div>
      ) : (
        <ul className="person-projects">
          {items.map((item) => (
            <li key={item.projectId} className="person-projects__item">
              <div className="person-projects__main">
                <Link className="row-link" to={`/projetos/${item.projectId}`}>
                  {item.projectName}
                </Link>
                {item.roleInProject ? <div className="table__secondary">{item.roleInProject}</div> : null}
              </div>
              {canManage ? (
                <Button
                  small
                  variant="ghost"
                  icon={<IconTrash size={15} />}
                  title="Desvincular"
                  aria-label={`Desvincular de ${item.projectName}`}
                  onClick={() => setRemoving(item)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

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
      guardChanges
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
        <div className="mb-16">
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
