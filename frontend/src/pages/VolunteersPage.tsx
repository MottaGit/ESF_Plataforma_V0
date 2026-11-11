import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { volunteersApi } from '../api/endpoints';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge, VolunteerStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CollapsibleFilters } from '../components/ui/CollapsibleFilters';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, LoadError, Loading } from '../components/ui/Feedback';
import { ExportSpreadsheetDialog } from '../components/spreadsheets/ExportSpreadsheetDialog';
import { IconDownload, IconKey, IconPlus, IconSearch, IconUpload } from '../components/ui/Icons';
import { PhotoCropper } from '../components/ui/PhotoCropper';
import { Modal } from '../components/ui/Modal';
import { ContactIcons } from '../components/volunteers/ContactLinks';
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
  todayInputValue,
  volunteerStatusLabel
} from '../utils/format';
import { useLatestRequest } from '../utils/useLatestRequest';

/** Ativos e afastados precisam do termo de adesao assinado (Lei 9.608/98). */
function needsTerm(volunteer: Volunteer) {
  return (volunteer.status === 'Ativo' || volunteer.status === 'Afastado') && !volunteer.termSignedOn;
}

/**
 * Situacao na lista (?situacao=). Sem nada, quem faz parte do nucleo hoje: ativos e afastados. Os anonimizados
 * ("Voluntario removido") so aparecem em "Todos".
 */
const SITUATIONS: Array<{ key: string; label: string; test: (volunteer: Volunteer) => boolean }> = [
  { key: '', label: 'Ativos e afastados', test: (v) => v.status === 'Ativo' || v.status === 'Afastado' },
  { key: 'ativos', label: 'Só ativos', test: (v) => v.status === 'Ativo' },
  { key: 'afastados', label: 'Só afastados', test: (v) => v.status === 'Afastado' },
  { key: 'inativos', label: 'Inativos', test: (v) => v.status === 'Inativo' },
  { key: 'ex-membros', label: 'Ex-membros', test: (v) => v.status === 'ExMembro' && !v.anonymized },
  { key: 'todos', label: 'Todos (com os anonimizados)', test: () => true }
];

/** Acesso a plataforma (?acesso=, so a coordenacao): para dar acesso a quem falta depois de importar uma planilha. */
const ACCESS_FILTERS: Array<{ key: string; label: string; test: (volunteer: Volunteer) => boolean }> = [
  { key: 'sem-acesso', label: 'Sem acesso', test: (v) => !v.access && !v.anonymized },
  { key: 'aguardando', label: 'Aguardando o primeiro acesso', test: (v) => Boolean(v.access?.isActive && v.access.pending) },
  { key: 'com-acesso', label: 'Com acesso', test: (v) => Boolean(v.access?.isActive && !v.access.pending) },
  { key: 'desativado', label: 'Acesso desativado', test: (v) => Boolean(v.access && !v.access.isActive) }
];

/** "5 sem termo: 2 sem acesso, 1 aguardando o primeiro acesso, 2 aguardando a assinatura". */
function pendingTermsDetail(pending: Volunteer[]) {
  const noAccess = pending.filter((v) => !v.access?.isActive).length;
  const firstAccess = pending.filter((v) => v.access?.isActive && v.access.pending).length;
  const signing = pending.length - noAccess - firstAccess;
  return [
    noAccess > 0 ? `${noAccess} sem acesso à plataforma` : null,
    firstAccess > 0 ? `${firstAccess} aguardando o primeiro acesso` : null,
    signing > 0 ? `${signing} aguardando a assinatura` : null
  ]
    .filter(Boolean)
    .join(', ');
}

export function VolunteersPage() {
  const { canManage, isAdmin } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  // Busca e filtros ficam na URL: voltar da pagina de uma pessoa (ou recarregar) mantem a lista como estava.
  const [searchParams, setSearchParams] = useSearchParams();
  const updateParams = useCallback(
    (changes: Record<string, string | null>) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
          return next;
        },
        { replace: true }
      ),
    [setSearchParams]
  );
  const debounced = searchParams.get('busca') ?? '';
  const sectorFilter = (searchParams.get('setor') ?? '') as VolunteerSector | '';
  const situation = SITUATIONS.find((item) => item.key === (searchParams.get('situacao') ?? '')) ?? SITUATIONS[0];
  const accessFilter = canManage ? ACCESS_FILTERS.find((item) => item.key === searchParams.get('acesso')) ?? null : null;
  const onlyPendingTerm = canManage && searchParams.get('termo') === 'pendente';

  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState(debounced);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => updateParams({ busca: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [search, updateParams]);

  const startRequest = useLatestRequest();
  const load = useCallback(async () => {
    const isCurrent = startRequest();
    setLoading(true);
    setError(null);
    try {
      const list = await volunteersApi.list(debounced || undefined, false, sectorFilter || undefined);
      if (isCurrent()) setVolunteers(list);
    } catch (err) {
      if (isCurrent()) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os voluntários.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [startRequest, debounced, sectorFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilters = [debounced, sectorFilter, situation.key, accessFilter?.key, onlyPendingTerm].filter(Boolean).length;
  const shown = volunteers.filter(
    (volunteer) =>
      (onlyPendingTerm ? needsTerm(volunteer) : situation.test(volunteer)) && (!accessFilter || accessFilter.test(volunteer))
  );
  const pending = canManage ? volunteers.filter(needsTerm) : [];
  const birthdayPeople = volunteers.filter((volunteer) => isBirthdayToday(volunteer.birthDay, volunteer.birthMonth));

  function clearFilters() {
    setSearch('');
    updateParams({ busca: null, setor: null, situacao: null, acesso: null, termo: null });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Voluntários</h1>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            {isAdmin ? (
              <Button icon={<IconDownload size={15} />} onClick={() => setExporting(true)}>
                Exportar
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => setFormOpen(true)}
            >
              Novo voluntário
            </Button>
          </div>
        ) : null}
      </div>

      <div className="toolbar">
        <CollapsibleFilters active={activeFilters}>
          <span className="search">
            <IconSearch className="search__icon" />
            <TextInput
              placeholder="Buscar por nome, e-mail ou competência"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar voluntários"
            />
          </span>

          <Select
            value={situation.key}
            onChange={(event) => updateParams({ situacao: event.target.value || null, termo: null })}
            aria-label="Situação"
          >
            {SITUATIONS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </Select>

          <Select
            value={sectorFilter}
            onChange={(event) => updateParams({ setor: event.target.value || null })}
            aria-label="Setor"
          >
            <option value="">Todos os setores</option>
            {VOLUNTEER_SECTORS.map((value) => (
              <option key={value} value={value}>
                {sectorLabel(value)}
              </option>
            ))}
          </Select>

          {canManage ? (
            <Select
              value={accessFilter?.key ?? ''}
              onChange={(event) => updateParams({ acesso: event.target.value || null })}
              aria-label="Acesso à plataforma"
            >
              <option value="">Qualquer acesso</option>
              {ACCESS_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Select>
          ) : null}
        </CollapsibleFilters>
      </div>

      {error ? <LoadError message={error} onRetry={() => void load()} /> : null}

      {pending.length > 0 || onlyPendingTerm ? (
        <div className="term-notice" role="status">
          <span className="avatar-flag avatar-flag--inline" aria-hidden="true">
            !
          </span>
          <span className="term-notice__text">
            {pending.length === 0
              ? 'Todos os voluntários ativos e afastados já têm o termo de adesão assinado.'
              : pending.length === 1
                ? `1 voluntário ativo ou afastado está sem o termo de adesão assinado: ${pendingTermsDetail(pending)}.`
                : `${pending.length} voluntários ativos ou afastados estão sem o termo de adesão assinado: ${pendingTermsDetail(pending)}.`}
          </span>
          <Button small variant="ghost" onClick={() => updateParams({ termo: onlyPendingTerm ? null : 'pendente' })}>
            {onlyPendingTerm ? 'Mostrar todos' : 'Ver quem falta'}
          </Button>
        </div>
      ) : null}

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

      {error ? null : (
      <section className="panel">
        {loading ? (
          <Loading label="Carregando voluntários…" />
        ) : volunteers.length === 0 && activeFilters === 0 ? (
          <EmptyState
            title="Nenhum voluntário cadastrado"
            description="Cadastre as pessoas que participam das ações para vinculá-las aos projetos."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  onClick={() => setFormOpen(true)}
                >
                  Cadastrar voluntário
                </Button>
              ) : undefined
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title={onlyPendingTerm ? 'Ninguém sem o termo de adesão' : 'Nenhum voluntário com esses filtros'}
            description={
              onlyPendingTerm
                ? 'Todos os voluntários ativos e afastados já têm o termo de adesão assinado.'
                : 'Mude a busca ou a situação (por padrão, só ativos e afastados).'
            }
            action={<Button onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Setor</th>
                  <th>Programas</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
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
                      <td className="cell--main">
                        <div className="person-cell">
                          <span className="avatar-flagged">
                            <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={32} />
                            {canManage && needsTerm(volunteer) ? (
                              <span
                                className="avatar-flag"
                                role="img"
                                aria-label="Termo de adesão pendente"
                                title="Termo de adesão pendente"
                              >
                                !
                              </span>
                            ) : null}
                          </span>
                          <div>
                            <Link className="row-link" to={`/voluntarios/${volunteer.id}`}>
                              {volunteer.name}
                            </Link>
                            {canManage && volunteer.access?.isActive ? (
                              <span
                                className={`access-mark${volunteer.access.pending ? ' access-mark--pending' : ''}`}
                                role="img"
                                aria-label={volunteer.access.pending ? 'Acesso aguardando o primeiro acesso' : 'Tem acesso à plataforma'}
                                title={volunteer.access.pending ? 'Acesso aguardando o primeiro acesso' : 'Tem acesso à plataforma'}
                              >
                                <IconKey size={13} />
                              </span>
                            ) : null}
                            {birthday ? (
                              <div style={{ marginTop: 4 }}>
                                <BirthdayBadge />
                              </div>
                            ) : null}
                            {volunteer.anonymized ? <div className="table__secondary">dados anonimizados</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="tight">
                        <ContactIcons name={volunteer.name} email={volunteer.email} phone={volunteer.phone} />
                      </td>
                      <td>{sectorLabel(volunteer.sector)}</td>
                      <td className="cell--desktop">{currentPrograms.length > 0 ? currentPrograms.join(', ') : '—'}</td>
                      {/* Celula vazia (ativo) nao ocupa lugar no cartao do celular. */}
                      <td className={volunteer.status === 'Ativo' ? 'cell--desktop' : undefined}>
                        <VolunteerStatusBadge status={volunteer.status} onlyException />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {formOpen ? (
        <VolunteerFormModal
          volunteer={null}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => {
            // A pagina da pessoa e onde vem o proximo passo: dar acesso e vincular a um projeto.
            setFormOpen(false);
            notify('Voluntário cadastrado.');
            navigate(`/voluntarios/${saved.id}`);
          }}
        />
      ) : null}

      {exporting ? <ExportSpreadsheetDialog initial={{ projects: false, volunteers: true }} onClose={() => setExporting(false)} /> : null}
    </>
  );
}

interface VolunteerFormModalProps {
  volunteer: Volunteer | null;
  onClose: () => void;
  onSaved: (saved: Volunteer) => void;
}

export function VolunteerFormModal({ volunteer, onClose, onSaved }: VolunteerFormModalProps) {
  const { user, refreshUser, isAdmin: userIsAdmin } = useAuth();
  const [name, setName] = useState(volunteer?.name ?? '');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [phone, setPhone] = useState(volunteer?.phone ?? '');
  const [sector, setSector] = useState<VolunteerSector>(volunteer?.sector ?? 'Projetos');
  const [skills, setSkills] = useState(volunteer?.skills ?? '');
  const [notes, setNotes] = useState(volunteer?.notes ?? '');
  const [status, setStatus] = useState<VolunteerStatus>(volunteer?.status ?? 'Ativo');

  // Saindo do nucleo (passou a Inativo ou Ex-membro nesta edicao): o formulario pergunta o que fazer com o acesso e
  // com as tarefas em aberto. As duas ja vem marcadas, porque e o que quase sempre se quer.
  const leaving =
    Boolean(volunteer) && (status === 'Inativo' || status === 'ExMembro') && volunteer?.status !== status;
  const access = volunteer?.access ?? null;
  const accessIsMine = Boolean(access && access.userId === user?.id);
  const canDeactivate = Boolean(access?.isActive) && !accessIsMine && (userIsAdmin || access?.role !== 'Administrador');
  const [deactivateAccess, setDeactivateAccess] = useState(true);
  const [releaseTasks, setReleaseTasks] = useState(true);
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  useEffect(() => {
    if (!leaving || !volunteer || openTasks !== null) return;
    volunteersApi
      .load()
      .then((list) => setOpenTasks(list.find((item) => item.volunteerId === volunteer.id)?.openActivities ?? 0))
      .catch(() => setOpenTasks(0));
  }, [leaving, volunteer, openTasks]);
  const [birthDay, setBirthDay] = useState(volunteer?.birthDay ? String(volunteer.birthDay) : '');
  const [birthMonth, setBirthMonth] = useState(volunteer?.birthMonth ? String(volunteer.birthMonth) : '');
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  // So no cadastro novo: desde quando esta no nucleo (as horas de voluntariado contam a partir dai).
  const [activeSince, setActiveSince] = useState(todayInputValue());
  const [activeSinceError, setActiveSinceError] = useState<string | null>(null);

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

    if (!volunteer && activeSince > todayInputValue()) {
      setActiveSinceError('Não pode ser depois de hoje.');
      return;
    }
    setActiveSinceError(null);

    const payload: SaveVolunteerPayload = {
      name: name.trim(),
      email: emptyToNull(email),
      phone: emptyToNull(phone),
      sector,
      skills: emptyToNull(skills),
      notes: emptyToNull(notes),
      status,
      birthDay: birthDay ? Number(birthDay) : null,
      birthMonth: birthMonth ? Number(birthMonth) : null,
      activeSince: volunteer ? null : activeSince || null,
      deactivateAccess: leaving && canDeactivate && deactivateAccess,
      releaseTasks: leaving && (openTasks ?? 0) > 0 && releaseTasks
    };

    setSaving(true);
    try {
      const saved = volunteer ? await volunteersApi.update(volunteer.id, payload) : await volunteersApi.create(payload);
      if (newPhoto) await volunteersApi.uploadPhoto(saved.id, newPhoto.blob);
      else if (photoRemoved && volunteer?.photoUrl) await volunteersApi.removePhoto(saved.id);
      // A foto do voluntario vinculado a conta aparece no topo da tela.
      if ((newPhoto || photoRemoved) && saved.id === user?.volunteerId) await refreshUser();
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o voluntário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={volunteer ? 'Editar voluntário' : 'Novo voluntário'}
      subtitle="Dados básicos de contato, setor e situação na organização."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          {/* Com o enquadramento da foto aberto, salvar perderia a foto: primeiro "Usar foto" (ou cancelar). */}
          <Button
            variant="primary"
            loading={saving}
            disabled={Boolean(photoToCrop)}
            title={photoToCrop ? 'Termine de enquadrar a foto' : undefined}
            onClick={(event) => void handleSubmit(event)}
          >
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
          <Field
            label="Nome"
            htmlFor="volunteer-name"
            required
            error={nameError ?? undefined}
            span
            hint="Nome completo, como no documento: é o que vai no termo de adesão e no certificado."
          >
            <TextInput
              id="volunteer-name"
              value={name}
              invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field
            label="E-mail"
            htmlFor="volunteer-email"
            hint={
              volunteer?.access
                ? 'É também o login desta pessoa na plataforma.'
                : 'Necessário para dar acesso à plataforma: é o login.'
            }
          >
            <TextInput id="volunteer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>

          <Field label="Telefone" htmlFor="volunteer-phone" hint="Com DDD. Celular (com o 9) ganha o atalho do WhatsApp.">
            <TextInput
              id="volunteer-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(51) 99999-9999"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
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

          {leaving && (access?.isActive || (openTasks ?? 0) > 0) ? (
            <fieldset className="leave-options span-2">
              <legend className="field__label">Saindo do núcleo</legend>
              {access?.isActive ? (
                canDeactivate ? (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={deactivateAccess}
                      onChange={(event) => setDeactivateAccess(event.target.checked)}
                    />
                    <span>
                      Desativar o acesso à plataforma
                      <span className="field__hint">
                        A pessoa deixa de entrar (e de ver os contatos de todos). Dá para reativar em Configurações ›
                        Acessos.
                      </span>
                    </span>
                  </label>
                ) : (
                  <p className="field__hint">
                    {accessIsMine
                      ? 'O acesso é o seu: ele continua ativo.'
                      : 'O acesso é de administrador: só outro administrador desativa (Configurações › Acessos).'}
                  </p>
                )
              ) : null}
              {(openTasks ?? 0) > 0 ? (
                <label className="checkbox">
                  <input type="checkbox" checked={releaseTasks} onChange={(event) => setReleaseTasks(event.target.checked)} />
                  <span>
                    {openTasks === 1
                      ? 'Deixar sem responsável a tarefa em aberto dela'
                      : `Deixar sem responsável as ${openTasks} tarefas em aberto dela`}
                    <span className="field__hint">
                      Para reatribuir em Tarefas › Filtros › Responsável: Sem responsável.
                    </span>
                  </span>
                </label>
              ) : null}
            </fieldset>
          ) : null}

          {!volunteer ? (
            <Field
              label="No núcleo desde"
              htmlFor="volunteer-active-since"
              error={activeSinceError ?? undefined}
              hint="As horas de voluntariado contam a partir desse dia. Depois, o histórico fica na página da pessoa."
            >
              <TextInput
                id="volunteer-active-since"
                type="date"
                max={todayInputValue()}
                value={activeSince}
                invalid={Boolean(activeSinceError)}
                onChange={(event) => setActiveSince(event.target.value)}
              />
            </Field>
          ) : null}

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
