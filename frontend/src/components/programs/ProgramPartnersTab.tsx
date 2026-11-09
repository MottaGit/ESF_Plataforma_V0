import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { ProgramPartner } from '../../types/api';
import { emptyToNull } from '../../utils/format';
import { EmailLink, PhoneLink } from '../volunteers/ContactLinks';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../ui/Feedback';
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** Sugestoes do campo Papel (texto livre: vale qualquer outro). */
const ROLE_SUGGESTIONS = ['Financiador', 'Apoiador', 'Parceiro técnico', 'Poder público', 'Gestora local', 'Doador de material'];

/** Itens novos ainda sem id da API. */
const NEW_ID = 'novo';

type PartnerValues = Omit<ProgramPartner, 'id'>;

function move<T>(list: T[], index: number, offset: number) {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + offset, 0, item);
  return next;
}

interface ProgramPartnersTabProps {
  programId: string;
  canEdit: boolean;
  /** Os nomes aparecem na visao do programa: ela recarrega junto. */
  onChanged: () => void;
}

/**
 * Editar programa › Parceiros: organizacoes parceiras do programa, na ordem em que aparecem. Nome e papel vao para a
 * visao do programa, a pagina publica e o PDF; contato e observacoes ficam so aqui. Cada mudanca grava a lista inteira.
 */
export function ProgramPartnersTab({ programId, canEdit, onChanged }: ProgramPartnersTabProps) {
  const { notify, notifyError } = useToast();
  const [partners, setPartners] = useState<ProgramPartner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; item: ProgramPartner | null } | null>(null);
  const [removing, setRemoving] = useState<{ index: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPartners(await programsApi.partners(programId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os parceiros.');
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Grava a lista como ficou. Erros sobem para quem chamou (o modal mostra a mensagem). */
  async function save(next: ProgramPartner[], message: string) {
    const saved = await programsApi.savePartners(programId, {
      partners: next.map((item) => ({ ...item, id: item.id === NEW_ID ? null : item.id }))
    });
    setPartners(saved);
    if (message) notify(message);
    onChanged();
  }

  async function saveQuietly(next: ProgramPartner[], message: string) {
    setBusy(true);
    try {
      await save(next, message);
      return true;
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível salvar os parceiros.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!partners) return <Loading label="Carregando parceiros…" />;

  return (
    <>
      <p className="field__hint template__intro">
        O nome e o papel de cada parceiro aparecem na visão do programa, na página pública e no relatório em PDF, nesta
        ordem. O contato e as observações ficam só aqui, para o núcleo.
      </p>

      <section className="panel partners-panel">
        <div className="panel__head">
          <h2>Parceiros</h2>
          <span className="tab__count num">{partners.length}</span>
          {canEdit ? (
            <div className="panel__actions">
              <Button small icon={<IconPlus size={15} />} onClick={() => setEditing({ index: -1, item: null })}>
                Parceiro
              </Button>
            </div>
          ) : null}
        </div>
        {partners.length === 0 ? (
          <EmptyState
            title="Nenhum parceiro"
            description="Inclua quem financia, apoia ou trabalha junto no programa: empresas, institutos, prefeitura, associações."
          />
        ) : (
          <ul className="template-list partner-list">
            {partners.map((partner, index) => (
              <li key={partner.id} className="template-list__item">
                <div className="template-list__main">
                  <div className="template-list__title">
                    {partner.name}
                    {partner.role ? <span className="partner-list__role">{partner.role}</span> : null}
                  </div>
                  {partner.contactName || partner.email || partner.phone ? (
                    <div className="template-list__meta partner-list__contact">
                      {partner.contactName ? <span>{partner.contactName}</span> : null}
                      {partner.email ? <EmailLink email={partner.email} /> : null}
                      {partner.phone ? <PhoneLink phone={partner.phone} /> : null}
                    </div>
                  ) : null}
                  {partner.notes ? <p className="template-list__desc">{partner.notes}</p> : null}
                </div>
                {canEdit ? (
                  <div className="row-actions">
                    <Button
                      small
                      variant="ghost"
                      icon={<IconChevronUp size={15} />}
                      title="Subir"
                      aria-label={`Subir "${partner.name}"`}
                      disabled={busy || index === 0}
                      onClick={() => void saveQuietly(move(partners, index, -1), '')}
                    />
                    <Button
                      small
                      variant="ghost"
                      icon={<IconChevronDown size={15} />}
                      title="Descer"
                      aria-label={`Descer "${partner.name}"`}
                      disabled={busy || index === partners.length - 1}
                      onClick={() => void saveQuietly(move(partners, index, 1), '')}
                    />
                    <Button
                      small
                      variant="ghost"
                      icon={<IconEdit size={15} />}
                      title="Editar"
                      aria-label={`Editar "${partner.name}"`}
                      onClick={() => setEditing({ index, item: partner })}
                    />
                    <Button
                      small
                      variant="ghost"
                      icon={<IconTrash size={15} />}
                      title="Remover"
                      aria-label={`Remover "${partner.name}"`}
                      onClick={() => setRemoving({ index, name: partner.name })}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <PartnerModal
          partner={editing.item}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const list =
              editing.index < 0
                ? [...partners, { ...values, id: NEW_ID }]
                : partners.map((item, i) => (i === editing.index ? { ...item, ...values } : item));
            await save(list, editing.item ? 'Parceiro atualizado.' : 'Parceiro incluído.');
            setEditing(null);
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Remover parceiro"
          message={`"${removing.name}" sai da lista de parceiros do programa, da página pública e dos próximos relatórios.`}
          confirmLabel="Remover"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void saveQuietly(
              partners.filter((_, i) => i !== removing.index),
              'Parceiro removido.'
            ).then((ok) => ok && setRemoving(null))
          }
        />
      ) : null}
    </>
  );
}

function PartnerModal({
  partner,
  onClose,
  onSave
}: {
  partner: ProgramPartner | null;
  onClose: () => void;
  onSave: (values: PartnerValues) => Promise<void>;
}) {
  const [name, setName] = useState(partner?.name ?? '');
  const [role, setRole] = useState(partner?.role ?? '');
  const [contactName, setContactName] = useState(partner?.contactName ?? '');
  const [email, setEmail] = useState(partner?.email ?? '');
  const [phone, setPhone] = useState(partner?.phone ?? '');
  const [notes, setNotes] = useState(partner?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 2) return setError('Informe o nome do parceiro.');
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        role: emptyToNull(role),
        contactName: emptyToNull(contactName),
        email: emptyToNull(email),
        phone: emptyToNull(phone),
        notes: emptyToNull(notes)
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o parceiro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={partner ? 'Editar parceiro' : 'Novo parceiro'}
      subtitle="Nome e papel aparecem na página pública e no PDF; o contato fica só no núcleo."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Salvar
          </Button>
        </>
      }
    >
      {error ? (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={submit} className="form-grid form-grid--single">
        <Field label="Nome da organização" htmlFor="partner-name" required>
          <TextInput
            id="partner-name"
            autoFocus
            maxLength={120}
            value={name}
            placeholder="Ex.: Instituto Aurora"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Papel" htmlFor="partner-role" hint="Escolha uma sugestão ou escreva outro.">
          <TextInput
            id="partner-role"
            list="partner-role-options"
            maxLength={60}
            value={role}
            placeholder="Ex.: Financiador"
            onChange={(event) => setRole(event.target.value)}
          />
          <datalist id="partner-role-options">
            {ROLE_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
        <Field label="Pessoa de contato" htmlFor="partner-contact">
          <TextInput
            id="partner-contact"
            maxLength={120}
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="E-mail" htmlFor="partner-email">
            <TextInput
              id="partner-email"
              type="email"
              maxLength={200}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Telefone" htmlFor="partner-phone">
            <TextInput
              id="partner-phone"
              type="tel"
              maxLength={40}
              value={phone}
              placeholder="(51) 99999-9999"
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Observações" htmlFor="partner-notes" hint="Ex.: o que a parceria cobre, prazos de prestação de contas.">
          <TextArea id="partner-notes" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
