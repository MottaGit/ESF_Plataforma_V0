import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { nationalApi } from '../../api/endpoints';
import { AccessLinkResultModal, NewAccessLinkModal } from '../access/AccessLinkModals';
import { NeutralBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { IconKey, IconPlus } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import type { Nucleo, NucleoAdmin } from '../../types/api';
import { emptyToNull } from '../../utils/format';
import { PersonFormModal, type GeneratedLink } from './PersonFormModal';

export function NucleosSection() {
  const { notify } = useToast();
  const [nucleos, setNucleos] = useState<Nucleo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Nucleo | null>(null);
  const [addingAdminTo, setAddingAdminTo] = useState<Nucleo | null>(null);
  const [linkFor, setLinkFor] = useState<{ nucleo: Nucleo; admin: NucleoAdmin } | null>(null);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setNucleos(await nationalApi.nucleos());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os núcleos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 620 }}>
          Cada núcleo nasce com quem vai administrá-lo: essa pessoa recebe um link de primeiro acesso e, lá dentro,
          cadastra os voluntários, dá os outros acessos e cuida dos dados do núcleo.
        </p>
        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            Novo núcleo
          </Button>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando núcleos…" />
        ) : nucleos.length === 0 ? (
          <EmptyState title="Nenhum núcleo cadastrado" />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Núcleo</th>
                  <th className="tight">Voluntários ativos</th>
                  <th className="tight">Projetos ativos</th>
                  <th>Administração</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {nucleos.map((nucleo) => (
                  <tr key={nucleo.id}>
                    <td className="cell--main">
                      <div className="table__primary">{nucleo.name}</div>
                      <div className="table__secondary">
                        {[nucleo.city, nucleo.state].filter(Boolean).join(' / ') || 'Local não informado'}
                      </div>
                    </td>
                    <td className="tight num" data-label="Voluntários ativos">{nucleo.activeVolunteers}</td>
                    <td className="tight num" data-label="Projetos ativos">{nucleo.activeProjects}</td>
                    <td className="cell--wide">
                      {nucleo.admins.length === 0 ? (
                        <span className="table__secondary">Sem administrador</span>
                      ) : (
                        <ul className="admin-list">
                          {nucleo.admins.map((admin) => (
                            <li key={admin.userId}>
                              <span>
                                {admin.name}
                                <span className="table__secondary"> · {admin.email}</span>
                                {!admin.isActive ? <NeutralBadge>Desativado</NeutralBadge> : null}
                                {admin.isActive && admin.pending ? <NeutralBadge>Aguardando o primeiro acesso</NeutralBadge> : null}
                              </span>
                              {admin.isActive ? (
                                <Button
                                  small
                                  variant="ghost"
                                  icon={<IconKey size={14} />}
                                  title="Gerar link de acesso (primeiro acesso ou senha esquecida)"
                                  aria-label={`Gerar link de acesso para ${admin.name}`}
                                  onClick={() => setLinkFor({ nucleo, admin })}
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="cell--actions">
                      <div className="row-actions">
                        <Menu
                          label={`Ações de ${nucleo.name}`}
                          items={[
                            { label: 'Editar núcleo', onSelect: () => setEditing(nucleo) },
                            { label: 'Novo administrador', onSelect: () => setAddingAdminTo(nucleo) }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating || editing ? (
        <NucleoFormModal
          nucleo={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(result) => {
            setCreating(false);
            setEditing(null);
            void load();
            if (result) setGenerated(result);
            else notify('Núcleo atualizado.');
          }}
        />
      ) : null}

      {addingAdminTo ? (
        <PersonFormModal
          title="Novo administrador"
          subtitle={addingAdminTo.name}
          hint="Se a pessoa já for voluntária do núcleo, o acesso nasce do cadastro dela; se já tiver acesso no núcleo, só passa a administradora."
          onClose={() => setAddingAdminTo(null)}
          onSubmit={async (name, email) => {
            const result = await nationalApi.addAdmin(addingAdminTo.id, name, email);
            setAddingAdminTo(null);
            void load();
            if (result.link) setGenerated({ title: 'Administrador incluído', name, email, link: result.link });
            else notify(`${name} já tinha acesso no núcleo e agora é administrador(a).`);
          }}
        />
      ) : null}

      {linkFor ? (
        <NewAccessLinkModal
          userId={linkFor.admin.userId}
          recipient={{ name: linkFor.admin.name, email: linkFor.admin.email, phone: null }}
          firstAccess={linkFor.admin.pending}
          generate={() => nationalApi.adminLink(linkFor.nucleo.id, linkFor.admin.userId)}
          onClose={() => setLinkFor(null)}
        />
      ) : null}

      {generated ? (
        <AccessLinkResultModal
          title={generated.title}
          link={generated.link}
          recipient={{ name: generated.name, email: generated.email, phone: null }}
          onClose={() => setGenerated(null)}
        />
      ) : null}
    </>
  );
}

/** Nucleo novo (com quem vai administrar) ou edicao de nome e local. */
function NucleoFormModal({
  nucleo,
  onClose,
  onSaved
}: {
  nucleo: Nucleo | null;
  onClose: () => void;
  /** Nucleo novo devolve o link de primeiro acesso de quem administra. */
  onSaved: (generated: GeneratedLink | null) => void;
}) {
  const [name, setName] = useState(nucleo?.name ?? '');
  const [city, setCity] = useState(nucleo?.city ?? '');
  const [state, setState] = useState(nucleo?.state ?? '');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3) {
      setError('Informe o nome do núcleo.');
      return;
    }
    if (!nucleo && (adminName.trim().length < 3 || !adminEmail.includes('@'))) {
      setError('Informe o nome e o e-mail de quem vai administrar o núcleo.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), city: emptyToNull(city), state: emptyToNull(state) };
      if (nucleo) {
        await nationalApi.updateNucleo(nucleo.id, payload);
        onSaved(null);
      } else {
        const result = await nationalApi.createNucleo({ ...payload, adminName: adminName.trim(), adminEmail: adminEmail.trim() });
        onSaved(
          result.link
            ? { title: 'Núcleo criado', name: adminName.trim(), email: adminEmail.trim(), link: result.link }
            : null
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o núcleo.');
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={nucleo ? 'Editar núcleo' : 'Novo núcleo'}
      subtitle={nucleo ? nucleo.name : 'O núcleo já nasce com quem vai administrá-lo.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            {nucleo ? 'Salvar' : 'Criar núcleo'}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? (
          <div className="span-2">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}
        <Field label="Nome do núcleo" htmlFor="nucleo-name" required span>
          <TextInput id="nucleo-name" value={name} placeholder="Ex.: ESF Curitiba" onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Cidade" htmlFor="nucleo-city">
          <TextInput id="nucleo-city" value={city} onChange={(event) => setCity(event.target.value)} />
        </Field>
        <Field label="Estado (UF)" htmlFor="nucleo-state">
          <TextInput id="nucleo-state" value={state} maxLength={60} placeholder="Ex.: PR" onChange={(event) => setState(event.target.value)} />
        </Field>
        {!nucleo ? (
          <>
            <Field label="Quem vai administrar" htmlFor="nucleo-admin-name" required>
              <TextInput id="nucleo-admin-name" value={adminName} onChange={(event) => setAdminName(event.target.value)} />
            </Field>
            <Field label="E-mail (login)" htmlFor="nucleo-admin-email" required>
              <TextInput
                id="nucleo-admin-email"
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
            </Field>
            <p className="field__hint span-2">
              A pessoa entra como voluntária e administradora do núcleo e recebe um link de primeiro acesso para criar a
              senha. Os dados do núcleo (CNPJ, logo, quem assina os termos) ela completa em Configurações.
            </p>
          </>
        ) : null}
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
