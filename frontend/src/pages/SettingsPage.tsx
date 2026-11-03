import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiError, assetUrl } from '../api/client';
import { authApi, organizationApi, usersApi, volunteersApi } from '../api/endpoints';
import { GrantAccessModal, NewAccessLinkModal } from '../components/access/AccessLinkModals';
import { AuditSection } from '../components/settings/AuditSection';
import { Avatar } from '../components/ui/Avatar';
import { NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconKey, IconPlus, IconTrash, IconUpload } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type {
  Organization,
  SaveOrganizationPayload,
  SaveUserPayload,
  User,
  UserRole,
  Volunteer
} from '../types/api';
import { USER_ROLES, emptyToNull, roleDescription, roleLabel } from '../utils/format';

type TabKey = 'organization' | 'users' | 'history' | 'account';

// A aba aberta fica na URL (?aba=conta), para o menu da conta e links diretos cairem no lugar certo.
const tabs: Array<{ key: TabKey; label: string; slug: string; adminOnly?: boolean; manageOnly?: boolean }> = [
  { key: 'organization', label: 'Organização', slug: 'organizacao', manageOnly: true },
  { key: 'users', label: 'Acessos', slug: 'acessos', manageOnly: true },
  { key: 'history', label: 'Histórico', slug: 'historico', adminOnly: true },
  { key: 'account', label: 'Minha conta', slug: 'conta' }
];

export function SettingsPage() {
  const { isAdmin, canManage } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Coordenacao ve tudo (o historico so a administracao); o voluntario comum, so a propria conta.
  const visibleTabs = tabs.filter((item) => (!item.adminOnly || isAdmin) && (!item.manageOnly || canManage));
  // "usuarios" e o nome antigo da aba Acessos, que links ja enviados ainda usam.
  const slug = searchParams.get('aba') === 'usuarios' ? 'acessos' : searchParams.get('aba');
  const tab = visibleTabs.find((item) => item.slug === slug)?.key ?? visibleTabs[0].key;

  // Os programas sairam daqui e foram para Projetos › Programas; links antigos continuam funcionando.
  if (searchParams.get('aba') === 'programas') return <Navigate to="/programas" replace />;

  function setTab(key: TabKey) {
    setSearchParams(key === visibleTabs[0].key ? {} : { aba: tabs.find((item) => item.key === key)!.slug }, { replace: true });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>{canManage ? 'Configurações' : 'Minha conta'}</h1>
        </div>
      </div>

      {visibleTabs.length > 1 ? (
        <ScrollTabs activeKey={tab}>
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`tab${tab === item.key ? ' tab--active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </ScrollTabs>
      ) : null}

      {tab === 'organization' ? <OrganizationSection canEdit={isAdmin} /> : null}
      {tab === 'users' ? <UsersSection canEdit={isAdmin} /> : null}
      {tab === 'history' ? <AuditSection /> : null}
      {tab === 'account' ? <AccountSection /> : null}
    </>
  );
}

function OrganizationSection({ canEdit }: { canEdit: boolean }) {
  const { notify, notifyError } = useToast();
  const logoInput = useRef<HTMLInputElement>(null);
  const signatureInput = useRef<HTMLInputElement>(null);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SaveOrganizationPayload>({
    name: '',
    legalName: null,
    cnpj: null,
    mission: null,
    about: null,
    email: null,
    phone: null,
    website: null,
    city: null,
    state: null,
    signatoryName: null,
    signatoryRole: null,
    signatoryNote: null
  });

  useEffect(() => {
    organizationApi
      .get()
      .then((data) => {
        setOrganization(data);
        setForm({
          name: data.name,
          legalName: data.legalName,
          cnpj: data.cnpj,
          mission: data.mission,
          about: data.about,
          email: data.email,
          phone: data.phone,
          website: data.website,
          city: data.city,
          state: data.state,
          signatoryName: data.signatoryName,
          signatoryRole: data.signatoryRole,
          signatoryNote: data.signatoryNote
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await organizationApi.update({
        ...form,
        name: form.name.trim(),
        legalName: emptyToNull(form.legalName),
        cnpj: emptyToNull(form.cnpj),
        mission: emptyToNull(form.mission),
        about: emptyToNull(form.about),
        email: emptyToNull(form.email),
        phone: emptyToNull(form.phone),
        website: emptyToNull(form.website),
        city: emptyToNull(form.city),
        state: emptyToNull(form.state),
        signatoryName: emptyToNull(form.signatoryName),
        signatoryRole: emptyToNull(form.signatoryRole),
        signatoryNote: emptyToNull(form.signatoryNote)
      });
      setOrganization(saved);
      notify('Dados da organização salvos.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const saved = await organizationApi.uploadLogo(file);
      setOrganization(saved);
      notify('Logo atualizado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível enviar o logo.');
    } finally {
      if (logoInput.current) logoInput.current.value = '';
    }
  }

  /** Envia (com arquivo) ou remove (sem) a imagem da assinatura usada nos certificados. */
  async function handleSignature(file: File | null) {
    try {
      const saved = file ? await organizationApi.uploadSignature(file) : await organizationApi.removeSignature();
      setOrganization(saved);
      notify(file ? 'Assinatura atualizada.' : 'Assinatura removida.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a assinatura.');
    } finally {
      if (signatureInput.current) signatureInput.current.value = '';
    }
  }

  if (loading) return <Loading label="Carregando dados da organização…" />;
  if (error) return <Alert kind="error">{error}</Alert>;

  return (
    <div className="grid-sidebar">
      <section className="panel">
        <div className="panel__head">
          <h2>Dados institucionais</h2>
        </div>
        <form className="panel__body" onSubmit={handleSave}>
          {!canEdit ? (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="info">Somente administradores podem alterar estes dados.</Alert>
            </div>
          ) : null}

          <div className="form-grid">
            <Field label="Nome" htmlFor="org-name" required span>
              <TextInput
                id="org-name"
                value={form.name}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>

            <Field label="Razão social" htmlFor="org-legal">
              <TextInput
                id="org-legal"
                value={form.legalName ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, legalName: event.target.value })}
              />
            </Field>

            <Field label="CNPJ" htmlFor="org-cnpj" hint="Aparece no rodapé dos relatórios.">
              <TextInput
                id="org-cnpj"
                value={form.cnpj ?? ''}
                placeholder="00.000.000/0000-00"
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, cnpj: event.target.value })}
              />
            </Field>

            <Field label="E-mail" htmlFor="org-email">
              <TextInput
                id="org-email"
                type="email"
                value={form.email ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>

            <Field label="Telefone" htmlFor="org-phone">
              <TextInput
                id="org-phone"
                value={form.phone ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>

            <Field label="Site" htmlFor="org-website">
              <TextInput
                id="org-website"
                value={form.website ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </Field>

            <Field label="Cidade" htmlFor="org-city">
              <TextInput
                id="org-city"
                value={form.city ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </Field>

            <Field label="Estado" htmlFor="org-state">
              <TextInput
                id="org-state"
                value={form.state ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
            </Field>

            <Field
              label="Quem assina pela organização"
              htmlFor="org-signatory"
              hint="Aparece nos termos de adesão e nos certificados de voluntariado."
            >
              <TextInput
                id="org-signatory"
                value={form.signatoryName ?? ''}
                disabled={!canEdit}
                placeholder="Ex.: Clívia Kellen Almeida Silva"
                onChange={(event) => setForm({ ...form, signatoryName: event.target.value })}
              />
            </Field>

            <Field label="Cargo de quem assina" htmlFor="org-signatory-role">
              <TextInput
                id="org-signatory-role"
                value={form.signatoryRole ?? ''}
                disabled={!canEdit}
                placeholder="Ex.: Diretora Geral"
                onChange={(event) => setForm({ ...form, signatoryRole: event.target.value })}
              />
            </Field>

            <Field
              label="Linha abaixo do cargo"
              htmlFor="org-signatory-note"
              hint="Opcional, aparece no certificado. Ex.: Gestão 2025."
            >
              <TextInput
                id="org-signatory-note"
                value={form.signatoryNote ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, signatoryNote: event.target.value })}
              />
            </Field>

            <Field label="Missão" htmlFor="org-mission" span>
              <TextArea
                id="org-mission"
                value={form.mission ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, mission: event.target.value })}
              />
            </Field>

            <Field label="Sobre a organização" htmlFor="org-about" span>
              <TextArea
                id="org-about"
                value={form.about ?? ''}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, about: event.target.value })}
              />
            </Field>
          </div>

          {canEdit ? (
            <div style={{ marginTop: 18 }}>
              <Button type="submit" variant="primary" loading={saving}>
                Salvar alterações
              </Button>
            </div>
          ) : null}
        </form>
      </section>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
      <section className="panel">
        <div className="panel__head">
          <h2>Logo</h2>
        </div>
        <div className="panel__body">
          <div
            style={{
              height: 130,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface-soft)',
              overflow: 'hidden',
              marginBottom: 12
            }}
          >
            {organization?.logoUrl ? (
              <img
                src={assetUrl(organization.logoUrl)}
                alt={`Logo de ${organization.name}`}
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span className="field__hint">Nenhum logo enviado</span>
            )}
          </div>

          {canEdit ? (
            <>
              <Button icon={<IconUpload size={15} />} block onClick={() => logoInput.current?.click()}>
                Enviar imagem
              </Button>
              <input ref={logoInput} type="file" accept="image/*" hidden onChange={handleLogo} />
              <p className="field__hint" style={{ marginTop: 8 }}>
                PNG ou JPG. O logo aparece nesta tela e identifica a organização na plataforma.
              </p>
            </>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Assinatura dos certificados</h2>
        </div>
        <div className="panel__body">
          <p className="field__hint" style={{ marginBottom: 12 }}>
            {organization?.hasSignature
              ? `Assinatura de ${organization.signatoryName ?? 'quem assina'} enviada. Ela só aparece nos certificados de voluntariado.`
              : 'Sem imagem de assinatura: o certificado sai com a linha em branco, para assinar à mão.'}
          </p>
          {canEdit ? (
            <div className="btn-row">
              <Button small icon={<IconUpload size={15} />} onClick={() => signatureInput.current?.click()}>
                {organization?.hasSignature ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
              {organization?.hasSignature ? (
                <Button small variant="ghost" onClick={() => void handleSignature(null)}>
                  Remover
                </Button>
              ) : null}
              <input
                ref={signatureInput}
                type="file"
                accept=".png,.jpg,.jpeg"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSignature(file);
                }}
              />
            </div>
          ) : null}
          <p className="field__hint" style={{ marginTop: 8 }}>PNG com fundo transparente fica melhor.</p>
        </div>
      </section>
      </div>
    </div>
  );
}

function UsersSection({ canEdit }: { canEdit: boolean }) {
  const { user: currentUser, refreshUser } = useAuth();
  const { notify, notifyError } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [linkFor, setLinkFor] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Voluntarios: para dar acesso (o acesso nasce do cadastro) e para o telefone no envio do link.
      const [loadedUsers, loadedVolunteers] = await Promise.all([usersApi.list(), volunteersApi.list()]);
      setUsers(loadedUsers);
      setVolunteers(loadedVolunteers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os acessos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await usersApi.remove(removing.id);
      notify('Acesso excluído.');
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o acesso.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 620 }}>
          Três perfis: administrador (acesso completo), coordenador (gerencia projetos e dados) e usuário (participa e
          atualiza a execução). O acesso nasce do cadastro do voluntário, de onde vêm o nome e o e-mail (o login), e
          sai como um link: a própria pessoa cria a senha. Para quem esqueceu a senha, gere um link novo.
        </p>
        {canEdit ? (
          <div className="toolbar__right">
            <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setGranting(true)}>
              Novo acesso
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando acessos…" />
        ) : users.length === 0 ? (
          <EmptyState title="Nenhum acesso cadastrado" />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  {canEdit ? (
                    <th className="right">
                      <span className="sr-only">Ações</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="cell--main">
                      <div className="person-cell">
                        <Avatar name={user.volunteerName ?? user.name} photoUrl={user.volunteerPhotoUrl} size={32} />
                        <div>
                          {user.volunteerId ? (
                            <Link className="row-link" to={`/voluntarios/${user.volunteerId}`}>
                              {user.volunteerName ?? user.name}
                            </Link>
                          ) : (
                            <div className="table__primary">{user.name}</div>
                          )}
                          <div className="table__secondary">
                            {user.email}
                            {user.id === currentUser?.id ? ' · você' : ''}
                            {!user.volunteerId ? ' · sem cadastro de voluntário' : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td title={roleDescription[user.role]}>{roleLabel(user.role)}</td>
                    <td>
                      <NeutralBadge>
                        {!user.isActive ? 'Desativado' : user.passwordPending ? 'Aguardando o primeiro acesso' : 'Ativo'}
                      </NeutralBadge>
                    </td>
                    {canEdit ? (
                      <td className="cell--actions">
                        <div className="row-actions">
                          {user.isActive ? (
                            <Button
                              small
                              variant="ghost"
                              icon={<IconKey size={15} />}
                              title="Gerar link de acesso (primeiro acesso ou senha esquecida)"
                              aria-label={`Gerar link de acesso para ${user.name}`}
                              onClick={() => setLinkFor(user)}
                            />
                          ) : null}
                          <Button
                            small
                            variant="ghost"
                            icon={<IconEdit size={15} />}
                            title="Editar perfil e situação"
                            aria-label={`Editar o acesso de ${user.volunteerName ?? user.name}`}
                            onClick={() => setEditing(user)}
                          />
                          {user.id !== currentUser?.id ? (
                            <Button
                              small
                              variant="ghost"
                              icon={<IconTrash size={15} />}
                              title="Excluir acesso"
                              aria-label={`Excluir o acesso de ${user.volunteerName ?? user.name}`}
                              onClick={() => setRemoving(user)}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {granting ? (
        <GrantAccessModal volunteers={volunteers} onClose={() => setGranting(false)} onGranted={() => void load()} />
      ) : null}

      {linkFor ? (
        <NewAccessLinkModal
          userId={linkFor.id}
          recipient={{
            name: linkFor.volunteerName ?? linkFor.name,
            email: linkFor.email,
            phone: volunteers.find((volunteer) => volunteer.id === linkFor.volunteerId)?.phone ?? null
          }}
          firstAccess={linkFor.passwordPending}
          onClose={() => setLinkFor(null)}
        />
      ) : null}

      {editing ? (
        <AccessFormModal
          user={editing}
          volunteers={volunteers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Acesso atualizado.');
            void load();
            // O proprio acesso: nome, foto e "Minhas atividades" mudam junto com o vinculo.
            if (editing.id === currentUser?.id) void refreshUser();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir acesso"
          message={`${removing.volunteerName ?? removing.name} perderá o acesso à plataforma. O cadastro de voluntário, os projetos e as tarefas continuam.`}
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

interface AccessFormModalProps {
  user: User;
  volunteers: Volunteer[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edicao de um acesso: perfil e situacao (acesso novo nasce do voluntario, em "Novo acesso"; senha, so por link).
 * Nome e e-mail vem do cadastro do voluntario; um acesso antigo, sem cadastro, pode ser ligado a um voluntario aqui.
 */
function AccessFormModal({ user, volunteers, onClose, onSaved }: AccessFormModalProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [volunteerId, setVolunteerId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada voluntario so pode estar ligado a um acesso, e o e-mail dele vira o login.
  const availableVolunteers = volunteers.filter((volunteer) => !volunteer.access && !volunteer.anonymized && volunteer.email);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload: SaveUserPayload = { role, isActive, volunteerId: volunteerId || null };

    setSaving(true);
    try {
      await usersApi.update(user.id, payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o acesso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Editar acesso"
      subtitle={`${user.volunteerName ?? user.name} · ${user.email}`}
      size="narrow"
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

        <div className="form-grid form-grid--single">
          <Field label="Perfil de acesso" htmlFor="user-role" required hint={roleDescription[role]}>
            <Select id="user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          {!user.volunteerId ? (
            <Field
              label="Cadastro de voluntário"
              htmlFor="user-volunteer"
              hint="Este acesso é de antes do cadastro de voluntários. Escolha quem é a pessoa: o nome e o e-mail (o login) passam a vir do cadastro."
            >
              <Select id="user-volunteer" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
                <option value="">Deixar sem cadastro</option>
                {availableVolunteers.map((volunteer) => (
                  <option key={volunteer.id} value={volunteer.id}>
                    {volunteer.name} · {volunteer.email}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="field__hint">Nome e e-mail (o login) mudam no cadastro do voluntário.</p>
          )}

          <div className="field">
            <label className="checkbox">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Acesso ativo
            </label>
            <span className="field__hint">Senha não se define aqui: para quem esqueceu, use o link de acesso (ícone da chave).</span>
          </div>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const { notify, notifyError } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      notify('Senha alterada.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível alterar a senha.';
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid-sidebar">
      <section className="panel">
        <div className="panel__head">
          <h2>Alterar senha</h2>
        </div>
        <form className="panel__body" onSubmit={handleSubmit}>
          {error ? (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{error}</Alert>
            </div>
          ) : null}

          <div className="form-grid form-grid--single" style={{ maxWidth: 420 }}>
            <Field label="Senha atual" htmlFor="current-password" required>
              <TextInput
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>

            <Field label="Nova senha" htmlFor="new-password" required hint="Mínimo de 6 caracteres.">
              <TextInput
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>

            <Field label="Confirmar nova senha" htmlFor="confirm-password" required>
              <TextInput
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          </div>

          <div style={{ marginTop: 18 }}>
            <Button type="submit" variant="primary" loading={saving}>
              Alterar senha
            </Button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ alignSelf: 'start' }}>
        <div className="panel__head">
          <h2>Sua conta</h2>
        </div>
        <div className="panel__body">
          <div className="meta-list">
            <div>
              <div className="meta__label">Nome</div>
              <div className="meta__value">{user?.name}</div>
            </div>
            <div>
              <div className="meta__label">E-mail</div>
              <div className="meta__value">{user?.email}</div>
            </div>
            <div>
              <div className="meta__label">Perfil</div>
              <div className="meta__value">{user ? roleLabel(user.role) : ''}</div>
              <div className="field__hint">{user ? roleDescription[user.role] : ''}</div>
            </div>
            <div>
              <div className="meta__label">Voluntário vinculado</div>
              <div className="meta__value">{user?.volunteerName ?? 'Nenhum'}</div>
              {!user?.volunteerName ? (
                <div className="field__hint">Peça a um administrador para vincular seu acesso ao seu cadastro.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
