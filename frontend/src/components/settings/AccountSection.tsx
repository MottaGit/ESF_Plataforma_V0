import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { MyTermPanel } from '../documents/MyTermPanel';
import { MyAvailabilityPanel } from '../volunteers/Availability';
import { Button } from '../ui/Button';
import { Field, PasswordInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { roleDescription, roleLabel } from '../../utils/format';

export function AccountSection() {
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
            <div className="mb-16">
              <Alert kind="error">{error}</Alert>
            </div>
          ) : null}

          <div className="form-grid form-grid--single measure-narrow">
            <Field label="Senha atual" htmlFor="current-password" required>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>

            <Field label="Nova senha" htmlFor="new-password" required hint="Mínimo de 6 caracteres.">
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>

            <Field label="Confirmar nova senha" htmlFor="confirm-password" required>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-16">
            <Button type="submit" variant="primary" loading={saving}>
              Alterar senha
            </Button>
          </div>
        </form>
      </section>

      <div className="detail-col">
        <section className="panel">
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

        <MyAvailabilityPanel volunteerId={user?.volunteerId ?? null} />

        <MyTermPanel volunteerId={user?.volunteerId ?? null} />
      </div>
    </div>
  );
}