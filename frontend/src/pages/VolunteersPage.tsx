import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { volunteersApi } from '../api/endpoints';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge, VolunteerStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconPlus, IconSearch, IconUpload } from '../components/ui/Icons';
import { PhotoCropper } from '../components/ui/PhotoCropper';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { SaveVolunteerPayload, Volunteer, VolunteerSector, VolunteerStatus } from '../types/api';
import {
  MONTH_NAMES,
  VOLUNTEER_SECTORS,
  VOLUNTEER_STATUSES,
  SENSITIVE_DATA_HINT,
  emptyToNull,
  isBirthdayToday,
  isPastProjectStatus,
  joinNames,
  sectorLabel,
  volunteerStatusLabel
} from '../utils/format';

/** Ativos e afastados precisam do termo de adesao assinado (Lei 9.608/98). */
function needsTerm(volunteer: Volunteer) {
  return (volunteer.status === 'Ativo' || volunteer.status === 'Afastado') && !volunteer.termSignedOn;
}

export function VolunteersPage() {
  const { canManage } = useAuth();
  const { notify, notifyError } = useToast();

  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<VolunteerSector | ''>('');
  const [onlyPendingTerm, setOnlyPendingTerm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [removing, setRemoving] = useState<Volunteer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVolunteers(await volunteersApi.list(debounced || undefined, onlyActive, sectorFilter || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os voluntários.');
    } finally {
      setLoading(false);
    }
  }, [debounced, onlyActive, sectorFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = onlyPendingTerm ? volunteers.filter(needsTerm) : volunteers;
  const birthdayPeople = volunteers.filter((volunteer) => isBirthdayToday(volunteer.birthDay, volunteer.birthMonth));

  /** LGPD: no lugar da exclusao, apaga os dados pessoais e mantem o historico dos projetos. */
  async function handleAnonymize() {
    if (!removing) return;
    setBusy(true);
    try {
      await volunteersApi.anonymize(removing.id);
      notify('Dados do voluntário anonimizados.');
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível anonimizar o voluntário.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Voluntários</h1>
          <p className="page-head__desc">Pessoas da organização: setor, situação e em quantos projetos atuam.</p>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Novo voluntário
            </Button>
          </div>
        ) : null}
      </div>

      <div className="toolbar">
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar voluntários"
          />
        </span>

        <Select
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value as VolunteerSector | '')}
          aria-label="Setor"
        >
          <option value="">Todos os setores</option>
          {VOLUNTEER_SECTORS.map((value) => (
            <option key={value} value={value}>
              {sectorLabel(value)}
            </option>
          ))}
        </Select>

        <div className="toolbar__right">
          <label className="checkbox">
            <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
            Só ativos
          </label>
          {canManage ? (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={onlyPendingTerm}
                onChange={(event) => setOnlyPendingTerm(event.target.checked)}
              />
              Só com termo pendente
            </label>
          ) : null}
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {birthdayPeople.length > 0 ? (
        <div className="birthday-notice" role="status">
          <span className="birthday-notice__icon" aria-hidden="true">
            🎂
          </span>
          <span>
            Hoje é aniversário de <strong>{joinNames(birthdayPeople.map((volunteer) => volunteer.name))}</strong>.
          </span>
        </div>
      ) : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando voluntários…" />
        ) : volunteers.length === 0 ? (
          <EmptyState
            title="Nenhum voluntário cadastrado"
            description="Cadastre as pessoas que participam das ações para vinculá-las aos projetos."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  Cadastrar voluntário
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Setor</th>
                  <th>Programas</th>
                  <th>Situação</th>
                  {canManage ? <th className="right">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="table__secondary">
                      Todos os voluntários ativos e afastados já têm o termo de adesão assinado.
                    </td>
                  </tr>
                ) : null}
                {shown.map((volunteer) => {
                  const currentPrograms = [
                    ...new Set(
                      volunteer.projects
                        .filter((item) => !isPastProjectStatus(item.projectStatus))
                        .map((item) => item.programName)
                    )
                  ];
                  const birthday = isBirthdayToday(volunteer.birthDay, volunteer.birthMonth);
                  return (
                    <tr key={volunteer.id} className={birthday ? 'table__row--birthday' : undefined}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={32} />
                          <div>
                            <Link className="row-link" to={`/voluntarios/${volunteer.id}`}>
                              {volunteer.name}
                            </Link>
                            {birthday ? (
                              <div style={{ marginTop: 4 }}>
                                <BirthdayBadge />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{sectorLabel(volunteer.sector)}</td>
                      <td>{currentPrograms.length > 0 ? currentPrograms.join(', ') : '—'}</td>
                      <td>
                        <VolunteerStatusBadge status={volunteer.status} />
                        {canManage && needsTerm(volunteer) ? (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge badge--pause" title="Sem termo de adesão assinado">
                              Termo pendente
                            </span>
                          </div>
                        ) : null}
                      </td>
                      {canManage ? (
                        <td>
                          {volunteer.anonymized ? (
                            <span className="table__secondary">dados anonimizados</span>
                          ) : (
                            <div className="row-actions">
                              <Button
                                small
                                variant="ghost"
                                icon={<IconEdit size={15} />}
                                title="Editar voluntário"
                                aria-label="Editar voluntário"
                                onClick={() => {
                                  setEditing(volunteer);
                                  setFormOpen(true);
                                }}
                              />
                              <Button
                                small
                                variant="ghost"
                                title="Apagar os dados pessoais e manter o histórico"
                                onClick={() => setRemoving(volunteer)}
                              >
                                Anonimizar
                              </Button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <VolunteerFormModal
          volunteer={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Voluntário atualizado.' : 'Voluntário cadastrado.');
            void load();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Anonimizar voluntário"
          message={`Os dados pessoais de ${removing.name} (nome, contatos, aniversário, foto e observações) serão apagados de vez. O histórico de projetos e tarefas continua, como "Voluntário removido", e os documentos assinados ficam guardados. Use quando a pessoa sair da organização ou pedir a exclusão dos dados. Não dá para desfazer.`}
          confirmLabel="Anonimizar"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleAnonymize()}
        />
      ) : null}
    </>
  );
}

interface VolunteerFormModalProps {
  volunteer: Volunteer | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VolunteerFormModal({ volunteer, onClose, onSaved }: VolunteerFormModalProps) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(volunteer?.name ?? '');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [phone, setPhone] = useState(volunteer?.phone ?? '');
  const [sector, setSector] = useState<VolunteerSector>(volunteer?.sector ?? 'Projetos');
  const [skills, setSkills] = useState(volunteer?.skills ?? '');
  const [notes, setNotes] = useState(volunteer?.notes ?? '');
  const [status, setStatus] = useState<VolunteerStatus>(volunteer?.status ?? 'Ativo');
  const [birthDay, setBirthDay] = useState(volunteer?.birthDay ? String(volunteer.birthDay) : '');
  const [birthMonth, setBirthMonth] = useState(volunteer?.birthMonth ? String(volunteer.birthMonth) : '');
  const [birthdayError, setBirthdayError] = useState<string | null>(null);

  // Foto: escolhida -> enquadrada -> enviada so ao salvar o voluntario.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null);
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const currentPhoto = newPhoto?.preview ?? (photoRemoved ? null : volunteer?.photoUrl ?? null);

  useEffect(() => () => (newPhoto ? URL.revokeObjectURL(newPhoto.preview) : undefined), [newPhoto]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (name.trim().length < 3) {
      setNameError('Informe o nome completo.');
      return;
    }
    setNameError(null);

    // Aniversario e opcional, mas dia e mes andam juntos e precisam formar uma data valida.
    if (Boolean(birthDay) !== Boolean(birthMonth)) {
      setBirthdayError('Escolha o dia e o mês, ou deixe os dois em branco.');
      return;
    }
    if (birthDay && Number(birthDay) > new Date(2000, Number(birthMonth), 0).getDate()) {
      setBirthdayError('Esse dia não existe no mês escolhido.');
      return;
    }
    setBirthdayError(null);

    const payload: SaveVolunteerPayload = {
      name: name.trim(),
      email: emptyToNull(email),
      phone: emptyToNull(phone),
      sector,
      skills: emptyToNull(skills),
      notes: emptyToNull(notes),
      status,
      birthDay: birthDay ? Number(birthDay) : null,
      birthMonth: birthMonth ? Number(birthMonth) : null
    };

    setSaving(true);
    try {
      const saved = volunteer ? await volunteersApi.update(volunteer.id, payload) : await volunteersApi.create(payload);
      if (newPhoto) await volunteersApi.uploadPhoto(saved.id, newPhoto.blob);
      else if (photoRemoved && volunteer?.photoUrl) await volunteersApi.removePhoto(saved.id);
      // A foto do voluntario vinculado a conta aparece no topo da tela.
      if ((newPhoto || photoRemoved) && saved.id === user?.volunteerId) await refreshUser();
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o voluntário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={volunteer ? 'Editar voluntário' : 'Novo voluntário'}
      subtitle="Dados básicos de contato, setor e situação na organização."
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

        <div className="photo-field">
          {photoToCrop ? (
            <PhotoCropper
              file={photoToCrop}
              onCancel={() => setPhotoToCrop(null)}
              onConfirm={(blob, preview) => {
                setNewPhoto({ blob, preview });
                setPhotoRemoved(false);
                setPhotoToCrop(null);
              }}
            />
          ) : (
            <>
              <Avatar name={name || '?'} photoUrl={currentPhoto} size={96} />
              <div className="photo-field__actions">
                <Button small icon={<IconUpload size={14} />} onClick={() => photoInputRef.current?.click()}>
                  {currentPhoto ? 'Trocar foto' : 'Adicionar foto'}
                </Button>
                {currentPhoto ? (
                  <Button
                    small
                    variant="ghost"
                    onClick={() => {
                      setNewPhoto(null);
                      setPhotoRemoved(true);
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              {newPhoto || photoRemoved ? (
                <span className="field__hint">A foto será atualizada ao salvar.</span>
              ) : null}
            </>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) setPhotoToCrop(file);
            }}
          />
        </div>

        <div className="form-grid">
          <Field label="Nome" htmlFor="volunteer-name" required error={nameError ?? undefined} span>
            <TextInput
              id="volunteer-name"
              value={name}
              invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="E-mail" htmlFor="volunteer-email">
            <TextInput id="volunteer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>

          <Field label="Telefone" htmlFor="volunteer-phone">
            <TextInput id="volunteer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>

          <Field
            label="Aniversário"
            htmlFor="volunteer-birth-day"
            hint="Só dia e mês. Usado para lembrar a data na plataforma."
            error={birthdayError ?? undefined}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                id="volunteer-birth-day"
                aria-label="Dia do aniversário"
                value={birthDay}
                style={{ flex: '0 0 92px' }}
                onChange={(event) => setBirthDay(event.target.value)}
              >
                <option value="">Dia</option>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Mês do aniversário"
                value={birthMonth}
                onChange={(event) => setBirthMonth(event.target.value)}
              >
                <option value="">Mês</option>
                {MONTH_NAMES.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <Field label="Setor" htmlFor="volunteer-sector" required>
            <Select id="volunteer-sector" value={sector} onChange={(event) => setSector(event.target.value as VolunteerSector)}>
              {VOLUNTEER_SECTORS.map((value) => (
                <option key={value} value={value}>
                  {sectorLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Situação" htmlFor="volunteer-status" required>
            <Select id="volunteer-status" value={status} onChange={(event) => setStatus(event.target.value as VolunteerStatus)}>
              {VOLUNTEER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {volunteerStatusLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Competências" htmlFor="volunteer-skills" span hint="Habilidades relevantes para os projetos.">
            <TextArea id="volunteer-skills" value={skills} onChange={(event) => setSkills(event.target.value)} />
          </Field>

          <Field label="Outras informações relevantes" htmlFor="volunteer-notes" span hint={SENSITIVE_DATA_HINT}>
            <TextArea id="volunteer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
