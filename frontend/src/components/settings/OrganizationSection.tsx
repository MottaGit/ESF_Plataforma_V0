import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, assetUrl } from '../../api/client';
import { organizationApi } from '../../api/endpoints';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, Loading } from '../ui/Feedback';
import { IconUpload } from '../ui/Icons';
import { useToast } from '../../context/ToastContext';
import type { Organization, SaveOrganizationPayload } from '../../types/api';
import { emptyToNull } from '../../utils/format';

export function OrganizationSection({ canEdit }: { canEdit: boolean }) {
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
            <div className="mb-16">
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
            <div className="mt-16">
              <Button type="submit" variant="primary" loading={saving}>
                Salvar alterações
              </Button>
            </div>
          ) : null}
        </form>
      </section>

      <div className="stack">
      <section className="panel">
        <div className="panel__head">
          <h2>Logo</h2>
        </div>
        <div className="panel__body">
          {/* Sem logo, so uma faixa baixa avisando; a moldura alta fica para mostrar a imagem enviada. */}
          <div className={`logo-preview${organization?.logoUrl ? '' : ' logo-preview--empty'}`}>
            {organization?.logoUrl ? (
              <img src={assetUrl(organization.logoUrl)} alt={`Logo de ${organization.name}`} />
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
              <p className="field__hint mt-8">
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
          <p className="field__hint mb-12">
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
          <p className="field__hint mt-8">PNG com fundo transparente fica melhor.</p>
        </div>
      </section>
      </div>
    </div>
  );
}
