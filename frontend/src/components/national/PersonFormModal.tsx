import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';
import type { AccessLink } from '../../types/api';

/** Link recem-gerado para mostrar (nucleo novo, administrador ou pessoa nova). */
export interface GeneratedLink {
  title: string;
  name: string;
  email: string;
  link: AccessLink;
}

/** Nome e e-mail de uma pessoa (administrador de nucleo ou da gestao nacional). */
export function PersonFormModal({
  title,
  subtitle,
  hint,
  onClose,
  onSubmit
}: {
  title: string;
  subtitle?: string;
  hint: string;
  onClose: () => void;
  onSubmit: (name: string, email: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3 || !email.includes('@')) {
      setError('Informe o nome e um e-mail válido.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim(), email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Incluir
          </Button>
        </>
      }
    >
      <form className="form-grid form-grid--single" onSubmit={handleSubmit}>
        {error ? <Alert kind="error">{error}</Alert> : null}
        <Field label="Nome" htmlFor="person-name" required>
          <TextInput id="person-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="E-mail (login)" htmlFor="person-email" required>
          <TextInput id="person-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <p className="field__hint">{hint}</p>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
