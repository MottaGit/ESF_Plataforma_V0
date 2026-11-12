import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { nationalApi } from '../../api/endpoints';
import { AccessLinkResultModal, NewAccessLinkModal } from '../access/AccessLinkModals';
import { NeutralBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert, ConfirmDialog, Loading } from '../ui/Feedback';
import { IconKey, IconPlus } from '../ui/Icons';
import { useToast } from '../../context/ToastContext';
import type { NationalPerson } from '../../types/api';
import { PersonFormModal, type GeneratedLink } from './PersonFormModal';

export function PeopleSection() {
  const { notify, notifyError } = useToast();
  const [people, setPeople] = useState<NationalPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [linkFor, setLinkFor] = useState<NationalPerson | null>(null);
  const [removing, setRemoving] = useState<NationalPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPeople(await nationalApi.people());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as pessoas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await nationalApi.removePerson(removing.userId);
      notify(`${removing.name} saiu da gestão nacional.`);
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível tirar a pessoa.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint measure">
          Quem faz parte da gestão nacional vê os números de todos os núcleos e cuida dos núcleos e dos indicadores
          nacionais. Pode ser uma conta só nacional ou alguém de um núcleo, que continua com o mesmo login.
        </p>
        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>
            Incluir pessoa
          </Button>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando…" />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Núcleo</th>
                  <th>Situação</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.userId}>
                    <td className="cell--main">
                      <div className="table__primary">{person.name}</div>
                      {person.isMe ? <div className="table__secondary">você</div> : null}
                    </td>
                    <td>{person.email}</td>
                    <td>{person.nucleoName ?? <span className="table__secondary">só gestão nacional</span>}</td>
                    <td>
                      <NeutralBadge>
                        {!person.isActive ? 'Desativado' : person.pending ? 'Aguardando o primeiro acesso' : 'Ativo'}
                      </NeutralBadge>
                    </td>
                    <td className="cell--actions">
                      <div className="row-actions">
                        {!person.nucleoName && person.isActive ? (
                          <Button
                            small
                            variant="ghost"
                            icon={<IconKey size={15} />}
                            title="Gerar link de acesso (primeiro acesso ou senha esquecida)"
                            aria-label={`Gerar link de acesso para ${person.name}`}
                            onClick={() => setLinkFor(person)}
                          />
                        ) : null}
                        {!person.isMe ? (
                          <Button small variant="ghost" onClick={() => setRemoving(person)}>
                            Tirar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding ? (
        <PersonFormModal
          title="Incluir na gestão nacional"
          hint="Se o e-mail já for o login de alguém de um núcleo, essa pessoa ganha a permissão e continua com a mesma senha (o menu Nacional aparece quando ela entrar de novo). Se não, nasce uma conta só nacional, com link de primeiro acesso."
          onClose={() => setAdding(false)}
          onSubmit={async (name, email) => {
            const result = await nationalApi.addPerson(name, email);
            setAdding(false);
            void load();
            if (result.link) setGenerated({ title: 'Pessoa incluída', name, email, link: result.link });
            else
              notify(
                `${result.person.name} (${result.person.nucleoName}) agora faz parte da gestão nacional; o menu Nacional aparece quando entrar de novo.`
              );
          }}
        />
      ) : null}

      {linkFor ? (
        <NewAccessLinkModal
          userId={linkFor.userId}
          recipient={{ name: linkFor.name, email: linkFor.email, phone: null }}
          firstAccess={linkFor.pending}
          generate={() => nationalApi.personLink(linkFor.userId)}
          onClose={() => setLinkFor(null)}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Tirar da gestão nacional"
          message={
            removing.nucleoName
              ? `${removing.name} deixa de ver a área Nacional e continua com o acesso no núcleo ${removing.nucleoName}.`
              : `${removing.name} deixa a gestão nacional e a conta (só nacional) fica desativada.`
          }
          confirmLabel="Tirar"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleRemove()}
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