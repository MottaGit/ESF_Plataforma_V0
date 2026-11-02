import { phoneHref, whatsAppHref } from '../../utils/format';
import { IconMail, IconPhone, IconWhatsApp } from '../ui/Icons';

interface ContactProps {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Contato em um toque, so com icones (listas): e-mail, ligacao e WhatsApp quando o telefone e celular. */
export function ContactIcons({ name, email, phone }: ContactProps) {
  const call = phoneHref(phone);
  const whatsApp = whatsAppHref(phone);
  if (!email && !call) return <span className="table__secondary">—</span>;

  return (
    <span className="contact-icons">
      {email ? (
        <a className="contact-icon" href={`mailto:${email}`} title={email} aria-label={`Enviar e-mail para ${name}`}>
          <IconMail size={16} />
        </a>
      ) : null}
      {call ? (
        <a className="contact-icon" href={call} title={phone ?? undefined} aria-label={`Ligar para ${name}`}>
          <IconPhone size={16} />
        </a>
      ) : null}
      {whatsApp ? (
        <a
          className="contact-icon contact-icon--whatsapp"
          href={whatsApp}
          target="_blank"
          rel="noopener noreferrer"
          title="Conversar no WhatsApp"
          aria-label={`Conversar com ${name} no WhatsApp`}
        >
          <IconWhatsApp size={16} />
        </a>
      ) : null}
    </span>
  );
}

/** E-mail por extenso que abre o programa de e-mail. */
export function EmailLink({ email }: { email: string | null }) {
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>—</>;
}

/** Telefone por extenso que liga ao toque, com o atalho do WhatsApp ao lado quando e celular. */
export function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) return <>—</>;
  const call = phoneHref(phone);
  const whatsApp = whatsAppHref(phone);

  return (
    <span className="contact-phone">
      {call ? <a href={call}>{phone}</a> : phone}
      {whatsApp ? (
        <a className="contact-phone__whatsapp" href={whatsApp} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp size={14} />
          WhatsApp
        </a>
      ) : null}
    </span>
  );
}
