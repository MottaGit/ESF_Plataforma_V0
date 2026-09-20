import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, assetUrl } from '../api/client';
import { authApi, organizationApi, usersApi } from '../api/endpoints';
import { NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconPlus, IconTrash, IconUpload } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Organization, SaveOrganizationPayload, SaveUserPayload, User, UserRole } from '../types/api';
import { USER_ROLES, emptyToNull, formatDate, roleDescription, roleLabel } from '../utils/format';

type TabKey = 'organization' | 'users' | 'account';

export function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>('organization');

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'organization', label: 'Organização' },
    { key: 'users', label: 'Usuários' },
    { key: 'account', label: 'Minha conta' }
  ];

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Configurações</h1>
          <p className="page-head__desc">Dados institucionais, acessos e sua própria conta.</p>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'organization' ? <OrganizationSection canEdit={isAdmin} /> : null}
      {tab === 'users' ? <UsersSection canEdit={isAdmin} /> : null}
      {tab === 'account' ? <AccountSection /> : null}
    </>
  );
}

function OrganizationSection({ canEdit }: { canEdit: boolean }) {
  const { notify, notifyError } = useToast();
  const logoInput = useRef<HTMLInputElement>(null);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SaveOrganizationPayload>({
    name: '',
    legalName: null,
    mission: null,
    about: null,
    email: null,
    phone: null,
    website: null,
    city: null,
    state: null
  });

  useEffect(() => {
    organizationApi
      .get()
      .then((data) => {
        setOrganization(data);
        setForm({
          name: data.name,
          legalName: data.legalName,
          mission: data.mission,
          about: data.about,
          email: data.email,
          phone: data.phone,
          website: data.website,
          city: data.city,
          state: data.state
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
        mission: emptyToNull(form.mission),
        about: emptyToNull(form.about),
        email: emptyToNull(form.email),
        phone: emptyToNull(form.phone),
        website: emptyToNull(form.website),
        city: emptyToNull(form.city),
        state: emptyToNull(form.state)
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

      <section className="panel" style={{ alignSelf: 'start' }}>
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
    </div>
  );
}

function UsersSection({ canEdit }: { canEdit: boolean }) {
  const { user: currentUser } = useAuth();
  const { notify, notifyError } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os usuários.');
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
      notify('Usuário excluído.');
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o usuário.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 560 }}>
          Três perfis: administrador (acesso completo), coordenador (gerencia projetos e dados) e usuário (participa e
          atualiza a execução).
        </p>
        {canEdit ? (
          <div className="toolbar__right">
            <Button
              variant="primary"
              small
              icon={<IconPlus size={15} />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Novo usuário
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando usuários…" />
        ) : users.length === 0 ? (
          <EmptyState title="Nenhum usuário cadastrado" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th className="tight">Desde</th>
                  {canEdit ? <th className="right">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="table__primary">{user.name}</div>
                      {user.id === currentUser?.id ? <div className="table__secondary">você</div> : null}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {roleLabel(user.role)}
                      <div className="table__secondary">{roleDescription[user.role]}</div>
                    </td>
                    <td>{user.isActive ? <NeutralBadge>Ativo</NeutralBadge> : <NeutralBadge>Desativado</NeutralBadge>}</td>
                    <td className="tight">{formatDate(user.createdAt)}</td>
                    {canEdit ? (
                      <td>
                        <div className="row-actions">
                          <Button
                            small
                            variant="ghost"
                            icon={<IconEdit size={15} />}
                            title="Editar usuário"
                            aria-label="Editar usuário"
                            onClick={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          />
                          {user.id !== currentUser?.id ? (
                            <Button
                              small
                              variant="ghost"
                              icon={<IconTrash size={15} />}
                              title="Excluir usuário"
                              aria-label="Excluir usuário"
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

      {formOpen ? (
        <UserFormModal
          user={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Usuário atualizado.' : 'Usuário criado.');
            void load();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir usuário"
          message={`${removing.name} perderá o acesso à plataforma. Projetos e atividades sob responsabilidade dele ficam sem responsável.`}
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

interface UserFormModalProps {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ user, onClose, onSaved }: UserFormModalProps) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'Usuario');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: Record<string, string> = {};
    if (name.trim().length < 3) found.name = 'Informe o nome completo.';
    if (!email.includes('@')) found.email = 'Informe um e-mail válido.';
    if (!user && password.length < 6) found.password = 'A senha deve ter ao menos 6 caracteres.';
    if (user && password && password.length < 6) found.password = 'A senha deve ter ao menos 6 caracteres.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: SaveUserPayload = {
      name: name.trim(),
      email: email.trim(),
      role,
      isActive,
      password,
      newPassword: password
    };

    setSaving(true);
    try {
      if (user) await usersApi.update(user.id, payload);
      else await usersApi.create(payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o usuário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={user ? 'Editar usuário' : 'Novo usuário'}
      subtitle={user ? user.email : 'O acesso é feito com e-mail e senha.'}
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
          <Field label="Nome" htmlFor="user-name" required error={errors.name} span>
            <TextInput
              id="user-name"
              value={name}
              invalid={Boolean(errors.name)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="E-mail" htmlFor="user-email" required error={errors.email}>
            <TextInput
              id="user-email"
              type="email"
              value={email}
              invalid={Boolean(errors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Perfil de acesso" htmlFor="user-role" required hint={roleDescription[role]}>
            <Select id="user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={user ? 'Nova senha' : 'Senha'}
            htmlFor="user-password"
            required={!user}
            error={errors.password}
            hint={user ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 6 caracteres.'}
            span
          >
            <TextInput
              id="user-password"
              type="password"
              value={password}
              invalid={Boolean(errors.password)}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {user ? (
            <div className="field span-2">
              <label className="checkbox">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Acesso ativo
              </label>
            </div>
          ) : null}
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
          </div>
        </div>
      </section>
    </div>
  );
}
