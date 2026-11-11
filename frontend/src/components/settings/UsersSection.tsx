import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { usersApi, volunteersApi } from '../../api/endpoints';
import { GrantAccessModal, NewAccessLinkModal } from '../access/AccessLinkModals';
import { Avatar } from '../ui/Avatar';
import { NeutralBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Select } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../ui/Feedback';
import { IconEdit, IconKey, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { SaveUserPayload, User, UserRole, Volunteer } from '../../types/api';
import { USER_ROLES, accessLinkStatus, roleDescription, roleLabel } from '../../utils/format';

/**
 * Acessos do nucleo. A coordenacao da acesso e gera link novo (o coordenador, nunca para um administrador); editar
 * perfil e situacao e excluir ficam com a administracao.
 */
export function UsersSection({ canEdit, canGrant }: { canEdit: boolean; canGrant: boolean }) {
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
        {canGrant ? (
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
                  {canGrant ? (
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
                      {user.isActive && user.passwordPending ? (
                        <div className="table__secondary">{accessLinkStatus(user.linkExpiresAt)}</div>
                      ) : null}
                    </td>
                    {canGrant ? (
                      <td className="cell--actions">
                        <div className="row-actions">
                          {user.isActive && (canEdit || user.role !== 'Administrador') ? (
                            <Button
                              small
                              variant="ghost"
                              icon={<IconKey size={15} />}
                              title="Gerar link de acesso (primeiro acesso ou senha esquecida)"
                              aria-label={`Gerar link de acesso para ${user.name}`}
                              onClick={() => setLinkFor(user)}
                            />
                          ) : null}
                          {canEdit ? (
                            <Button
                              small
                              variant="ghost"
                              icon={<IconEdit size={15} />}
                              title="Editar perfil e situação"
                              aria-label={`Editar o acesso de ${user.volunteerName ?? user.name}`}
                              onClick={() => setEditing(user)}
                            />
                          ) : null}
                          {canEdit && user.id !== currentUser?.id ? (
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
      guardChanges
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
