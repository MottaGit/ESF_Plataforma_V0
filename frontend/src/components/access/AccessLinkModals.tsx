import { useState } from 'react';
import { ApiError } from '../../api/client';
import { accessApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { AccessLink, UserRole, Volunteer } from '../../types/api';
import { USER_ROLES, formatDate, roleDescription, roleLabel, whatsAppHref } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconMail, IconWhatsApp } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** Quem recebe o link: o nome entra na mensagem, telefone e e-mail viram atalhos de envio. */
interface Recipient {
  name: string;
  phone: string | null;
  email: string | null;
}

interface GrantAccessModalProps {
  /** Voluntario que recebe o acesso; sem ele, a janela pede para escolher entre `volunteers`. */
  volunteer?: Volunteer;
  volunteers?: Volunteer[];
  onClose: () => void;
  /** Acesso criado (quem abriu recarrega a pagina ou a lista). */
  onGranted: () => void;
}

/**
 * Dar acesso a um voluntario: escolhe o perfil (o login e o e-mail do cadastro) e sai o link de primeiro acesso,
 * para a propria pessoa criar a senha.
 */
export function GrantAccessModal({ volunteer, volunteers, onClose, onGranted }: GrantAccessModalProps) {
  const [volunteerId, setVolunteerId] = useState(volunteer?.id ?? '');
  const [role, setRole] = useState<UserRole>('Usuario');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<AccessLink | null>(null);

  // Sem acesso ainda e com e-mail (que e o login); anonimizados ficam de fora.
  const eligible = (volunteers ?? []).filter((item) => !item.access && !item.anonymized);
  const chosen = volunteer ?? eligible.find((item) => item.id === volunteerId) ?? null;

  async function grant() {
    if (!chosen) {
      setError('Escolha o voluntário.');
      return;
    }
    if (!chosen.email) {
      setError('Cadastre o e-mail do voluntário antes de dar acesso: ele é o login.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setLink(await accessApi.grant(chosen.id, role));
      onGranted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível dar o acesso.');
    } finally {
      setSaving(false);
    }
  }

  if (link && chosen) {
    return (
      <Modal title="Acesso criado" subtitle={chosen.name} onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
        <AccessLinkResult link={link} recipient={chosen} firstAccess />
      </Modal>
    );
  }

  return (
    <Modal
      title="Dar acesso à plataforma"
      subtitle={volunteer ? volunteer.name : 'O acesso nasce do cadastro do voluntário.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void grant()}>
            Gerar link de acesso
          </Button>
        </>
      }
    >
      <div className="form-grid form-grid--single">
        {error ? <Alert kind="error">{error}</Alert> : null}

        {!volunteer ? (
          <Field label="Voluntário" htmlFor="grant-volunteer" required hint="Só aparecem voluntários que ainda não têm acesso.">
            <Select id="grant-volunteer" value={volunteerId} onChange={(event) => setVolunteerId(event.target.value)}>
              <option value="">Escolha o voluntário</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.email ? '' : ' (sem e-mail)'}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Login" htmlFor="grant-email" hint="É o e-mail do cadastro do voluntário.">
          <TextInput id="grant-email" value={chosen?.email ?? ''} placeholder="—" readOnly />
        </Field>

        <Field label="Perfil de acesso" htmlFor="grant-role" required hint={roleDescription[role]}>
          <Select id="grant-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </Select>
        </Field>

        <p className="field__hint">
          Sai um link de primeiro acesso para você mandar à pessoa. Ela abre, cria a própria senha e já entra; ninguém
          mais fica sabendo a senha dela.
        </p>
      </div>
    </Modal>
  );
}

interface NewAccessLinkModalProps {
  userId: string;
  recipient: Recipient;
  /** Ainda espera o primeiro acesso (sem senha) ou ja usa a plataforma (link para criar uma senha nova). */
  firstAccess: boolean;
  onClose: () => void;
}

/** Link novo para um acesso que ja existe: primeiro acesso perdido ou senha esquecida. */
export function NewAccessLinkModal({ userId, recipient, firstAccess, onClose }: NewAccessLinkModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<AccessLink | null>(null);

  async function generate() {
    setSaving(true);
    setError(null);
    try {
      setLink(await accessApi.newLink(userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o link.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Link de acesso"
      subtitle={recipient.name}
      onClose={onClose}
      footer={
        link ? (
          <Button onClick={onClose}>Fechar</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={() => void generate()}>
              Gerar link
            </Button>
          </>
        )
      }
    >
      {link ? (
        <AccessLinkResult link={link} recipient={recipient} firstAccess={firstAccess} />
      ) : (
        <div className="form-grid form-grid--single">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <p>
            {firstAccess
              ? 'Um link novo de primeiro acesso, para quem perdeu o anterior ou deixou vencer.'
              : 'Um link para a pessoa criar uma senha nova (por exemplo, se esqueceu a atual).'}{' '}
            Os links anteriores que ainda não foram usados deixam de valer.
          </p>
        </div>
      )}
    </Modal>
  );
}

/** O link gerado, com os atalhos para mandar (copiar, WhatsApp, e-mail) e a validade. */
function AccessLinkResult({ link, recipient, firstAccess }: { link: AccessLink; recipient: Recipient; firstAccess: boolean }) {
  const { notify, notifyError } = useToast();
  const url = `${window.location.origin}/acesso/${link.token}`;
  const until = formatDate(link.expiresAt);
  const firstName = recipient.name.split(' ')[0];
  const message = firstAccess
    ? `Olá, ${firstName}! Você recebeu acesso à plataforma de gestão do ESF. Crie sua senha por este link (vale até ${until}, uma vez só): ${url}`
    : `Olá, ${firstName}! Este é o seu link para criar uma nova senha na plataforma de gestão do ESF (vale até ${until}, uma vez só): ${url}`;
  const whatsApp = whatsAppHref(recipient.phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copiado.');
    } catch {
      notifyError('Não foi possível copiar. Selecione o link e copie à mão.');
    }
  }

  return (
    <div className="access-link">
      <Alert kind="info">
        Mande este link para {firstName}. Ele vale até {until}, funciona uma vez só e não aparece de novo: se precisar,
        gere outro.
      </Alert>
      <TextInput value={url} readOnly aria-label="Link de acesso" onFocus={(event) => event.target.select()} />
      <div className="access-link__actions">
        <Button variant="primary" onClick={() => void copy()}>
          Copiar link
        </Button>
        {whatsApp ? (
          <a className="btn" href={`${whatsApp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <IconWhatsApp size={15} />
            Enviar pelo WhatsApp
          </a>
        ) : null}
        {recipient.email ? (
          <a
            className="btn"
            href={`mailto:${recipient.email}?subject=${encodeURIComponent('Acesso à plataforma do ESF')}&body=${encodeURIComponent(message)}`}
          >
            <IconMail size={15} />
            Enviar por e-mail
          </a>
        ) : null}
      </div>
    </div>
  );
}
