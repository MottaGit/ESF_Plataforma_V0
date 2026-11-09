import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { nationalApi, nationalIndicatorsApi } from '../api/endpoints';
import { AccessLinkResultModal, NewAccessLinkModal } from '../components/access/AccessLinkModals';
import { NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, TextArea, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, LoadError, Loading } from '../components/ui/Feedback';
import { IconKey, IconPlus } from '../components/ui/Icons';
import { Menu } from '../components/ui/Menu';
import { Modal } from '../components/ui/Modal';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useToast } from '../context/ToastContext';
import type {
  AccessLink,
  NationalIndicator,
  NationalPanel,
  NationalPerson,
  Nucleo,
  NucleoAdmin,
  SummedValue
} from '../types/api';
import { coverageLabel, emptyToNull, formatDate, formatNumber, todayInputValue } from '../utils/format';

type TabKey = 'panel' | 'nucleos' | 'indicators' | 'people';

const tabs: Array<{ key: TabKey; label: string; slug: string }> = [
  { key: 'panel', label: 'Painel', slug: 'painel' },
  { key: 'nucleos', label: 'Núcleos', slug: 'nucleos' },
  { key: 'indicators', label: 'Indicadores nacionais', slug: 'indicadores' },
  { key: 'people', label: 'Pessoas da gestão nacional', slug: 'pessoas' }
];

/** Link recem-gerado para mostrar (nucleo novo, administrador ou pessoa nova). */
interface GeneratedLink {
  title: string;
  name: string;
  email: string;
  link: AccessLink;
}

/**
 * Gestao nacional: os nucleos da plataforma (com quem os administra) e as pessoas da propria gestao nacional.
 * So numeros e contatos de quem administra; os dados de dentro dos nucleos ficam com cada nucleo.
 */
export function NationalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabs.find((item) => item.slug === searchParams.get('aba'))?.key ?? tabs[0].key;

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Gestão nacional</h1>
          <p className="page-head__desc">
            Só números: os dados de dentro dos núcleos (voluntários, projetos, registros) ficam com cada núcleo.
          </p>
        </div>
      </div>

      <ScrollTabs activeKey={tab}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => setSearchParams(item.key === tabs[0].key ? {} : { aba: item.slug }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </ScrollTabs>

      {tab === 'panel' ? <PanelSection /> : null}
      {tab === 'nucleos' ? <NucleosSection /> : null}
      {tab === 'indicators' ? <NationalIndicatorsSection /> : null}
      {tab === 'people' ? <PeopleSection /> : null}
    </>
  );
}

/**
 * Painel: os numeros de todos os nucleos, no total e por nucleo. Tarefas concluidas, registros e horas contam no
 * periodo escolhido (o ano corrente, por padrao); projetos, voluntarios ativos e indicadores sao a situacao de hoje.
 */
function PanelSection() {
  const today = todayInputValue();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [panel, setPanel] = useState<NationalPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Trocar o periodo mantem os numeros anteriores na tela ate chegarem os novos: "Atualizando…" avisa.
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const periodError = from && to && to < from ? 'O fim do período não pode ser antes do início.' : null;

  useEffect(() => {
    if (periodError) return;
    let active = true;
    setError(null);
    setRefreshing(true);
    nationalApi
      .panel(from || null, to || null)
      .then((result) => active && setPanel(result))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [from, to, periodError, attempt]);

  const totals = panel?.totals;
  const stats = totals
    ? [
        { label: 'núcleos', value: totals.nucleos },
        { label: 'projetos ativos', value: totals.activeProjects },
        { label: 'projetos concluídos', value: totals.concludedProjects },
        { label: 'voluntários ativos', value: totals.activeVolunteers },
        { label: 'horas de voluntariado estimadas no período', value: totals.volunteerHours },
        { label: 'tarefas concluídas no período', value: totals.tasksCompleted },
        { label: 'registros de andamento no período', value: totals.records }
      ]
    : [];

  return (
    <>
      <div className="toolbar">
        <div className="field">
          <span className="field__label">Período</span>
          <div className="report-period">
            <TextInput
              type="date"
              aria-label="Início do período"
              value={from}
              invalid={Boolean(periodError)}
              onChange={(event) => setFrom(event.target.value)}
            />
            <span className="report-period__sep">a</span>
            <TextInput
              type="date"
              aria-label="Fim do período"
              value={to}
              invalid={Boolean(periodError)}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          {periodError ? <span className="field__error">{periodError}</span> : null}
        </div>
        <p className="field__hint" style={{ maxWidth: 420 }}>
          O período vale para horas, tarefas concluídas e registros. Projetos, voluntários e indicadores mostram a
          situação de hoje. Ativos: em planejamento, em andamento ou pausados. Horas estimadas: 6 h por semana de cada
          voluntário ativo (não são as horas lançadas nos projetos).
        </p>
      </div>

      {error ? <LoadError message={error} onRetry={() => setAttempt((current) => current + 1)} /> : null}
      {refreshing && panel ? (
        <p className="field__hint" role="status">
          Atualizando os números…
        </p>
      ) : null}

      {!panel ? (
        error ? null : <Loading label="Carregando o painel…" />
      ) : (
        <>
          <div className="national-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="national-stat">
                <div className="national-stat__value num">{formatNumber(stat.value)}</div>
                <div className="national-stat__label">{stat.label}</div>
              </div>
            ))}
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel__head">
              <h2>Indicadores nacionais</h2>
            </div>
            <div className="panel__body">
              {panel.indicators.length === 0 ? (
                <EmptyState
                  title="Nenhum indicador nacional"
                  description="Cadastre na aba Indicadores nacionais: eles entram em todo projeto de todos os núcleos e a soma aparece aqui."
                />
              ) : (
                <>
                  <div className="national-stats">
                    {panel.indicators.map((indicator) => {
                      const coverage = coverageLabel(indicator.informed, indicator.projects);
                      return (
                        <div key={indicator.id} className="national-stat national-stat--result">
                          <div className="national-stat__value num">
                            {indicator.total == null ? (
                              '—'
                            ) : (
                              <>
                                {formatNumber(indicator.total)}
                                {indicator.unit ? <small> {indicator.unit}</small> : null}
                              </>
                            )}
                          </div>
                          <div className="national-stat__label">{indicator.name}</div>
                          {indicator.total == null ? (
                            <div className="national-stat__hint">nenhum projeto informou</div>
                          ) : coverage ? (
                            <div className="national-stat__hint">{coverage}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    Valores atuais, somados nos projetos de todos os núcleos (os arquivados entram; os cancelados, não).
                    Só soma o que foi informado: em branco não conta como zero, e "—" quer dizer que nenhum projeto
                    informou.
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel__head">
              <h2>Por núcleo</h2>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <thead>
                  <tr>
                    <th>Núcleo</th>
                    <th className="tight">Projetos ativos</th>
                    <th className="tight">Concluídos</th>
                    <th className="tight">Voluntários ativos</th>
                    <th className="tight">Horas estimadas no período</th>
                    <th className="tight">Tarefas no período</th>
                    <th className="tight">Registros no período</th>
                    <th className="tight">Última atividade</th>
                    {panel.indicators.map((indicator) => (
                      <th key={indicator.id} className="tight">
                        {indicator.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {panel.nucleos.map((row) => (
                    <tr key={row.id}>
                      <td className="cell--main" style={{ minWidth: 150 }}>
                        <div className="table__primary">{row.name}</div>
                        <div className="table__secondary">{[row.city, row.state].filter(Boolean).join(' / ') || '—'}</div>
                      </td>
                      <td className="tight num" data-label="Projetos ativos">{row.activeProjects}</td>
                      <td className="tight num" data-label="Concluídos">{row.concludedProjects}</td>
                      <td className="tight num" data-label="Voluntários ativos">{row.activeVolunteers}</td>
                      <td className="tight num" data-label="Horas estimadas">{formatNumber(row.volunteerHours)}</td>
                      <td className="tight num" data-label="Tarefas">{row.tasksCompleted}</td>
                      <td className="tight num" data-label="Registros">{row.records}</td>
                      <td className="tight" data-label="Última atividade">{row.lastActivityAt ? formatDate(row.lastActivityAt) : 'nenhuma'}</td>
                      {panel.indicators.map((indicator) => (
                        <td key={indicator.id} className="tight num" data-label={indicator.name}>
                          <SummedCell value={row.indicators[indicator.id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** Valor de um indicador nacional num nucleo: "—" quando nenhum projeto informou, e quantos informaram quando falta algum. */
function SummedCell({ value }: { value: SummedValue | undefined }) {
  if (!value || value.total == null) {
    return (
      <span className="table__secondary" title="Nenhum projeto informou">
        —
      </span>
    );
  }
  const coverage = coverageLabel(value.informed, value.projects);
  return (
    <>
      {formatNumber(value.total)}
      {coverage ? <div className="table__secondary">{coverage}</div> : null}
    </>
  );
}

function NucleosSection() {
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

/** Nome e e-mail de uma pessoa (administrador de nucleo ou da gestao nacional). */
function PersonFormModal({
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

/**
 * Indicadores nacionais: a lista comum que entra em todo projeto de todos os nucleos. O painel soma pelo vinculo;
 * renomear vale para todos os nucleos; arquivar deixa de exigir sem apagar o que ja foi registrado.
 */
function NationalIndicatorsSection() {
  const { notify, notifyError } = useToast();
  const [indicators, setIndicators] = useState<NationalIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NationalIndicator | 'new' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setIndicators(await nationalIndicatorsApi.list(true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os indicadores nacionais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setArchived(indicator: NationalIndicator, archived: boolean) {
    try {
      await nationalIndicatorsApi.setArchived(indicator.id, archived);
      notify(archived ? 'Indicador arquivado.' : 'Indicador reativado.');
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o indicador.');
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint" style={{ maxWidth: 620 }}>
          Estes indicadores entram sozinhos em todo projeto de todos os núcleos, em branco até cada núcleo informar o
          número; é o que permite somar os resultados de todos. Diga como contar, para todos contarem do mesmo jeito.
          Mudar o nome ou a unidade vale para todos os núcleos; arquivar deixa de exigir o indicador (os números já
          informados continuam).
        </p>
        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setEditing('new')}>
            Novo indicador nacional
          </Button>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando indicadores…" />
        ) : indicators.length === 0 ? (
          <EmptyState
            title="Nenhum indicador nacional"
            description="Cadastre os resultados que todos os núcleos acompanham (ex.: pessoas beneficiadas, famílias atendidas)."
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Unidade</th>
                  <th>Como contar</th>
                  <th>Situação</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((indicator) => (
                  <tr key={indicator.id}>
                    <td className="table__primary cell--main">{indicator.name}</td>
                    <td data-label="Unidade">{indicator.unit ?? '—'}</td>
                    <td className="table__secondary cell--wide">{indicator.description ?? '—'}</td>
                    <td>
                      <NeutralBadge>{indicator.isArchived ? 'Arquivado' : 'Ativo'}</NeutralBadge>
                    </td>
                    <td className="cell--actions">
                      <div className="row-actions">
                        <Menu
                          label={`Ações de ${indicator.name}`}
                          items={[
                            { label: 'Editar', onSelect: () => setEditing(indicator) },
                            indicator.isArchived
                              ? { label: 'Reativar', onSelect: () => void setArchived(indicator, false) }
                              : { label: 'Arquivar', onSelect: () => void setArchived(indicator, true) }
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

      {editing ? (
        <NationalIndicatorFormModal
          indicator={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify(editing === 'new' ? 'Indicador nacional criado.' : 'Indicador nacional atualizado.');
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function NationalIndicatorFormModal({
  indicator,
  onClose,
  onSaved
}: {
  indicator: NationalIndicator | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.unit ?? '');
  const [description, setDescription] = useState(indicator?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe o nome do indicador.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), unit: emptyToNull(unit), description: emptyToNull(description) };
      if (indicator) await nationalIndicatorsApi.update(indicator.id, payload);
      else await nationalIndicatorsApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o indicador.');
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={indicator ? 'Editar indicador nacional' : 'Novo indicador nacional'}
      subtitle={indicator ? 'Nome e unidade novos valem para todos os núcleos.' : 'Entra em todos os projetos de todos os núcleos, em branco até cada um informar.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Salvar
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
        <Field label="Nome" htmlFor="national-indicator-name" required>
          <TextInput
            id="national-indicator-name"
            value={name}
            placeholder="Ex.: Pessoas beneficiadas"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Unidade" htmlFor="national-indicator-unit">
          <TextInput
            id="national-indicator-unit"
            maxLength={60}
            value={unit}
            placeholder="Ex.: pessoas, famílias, m²"
            onChange={(event) => setUnit(event.target.value)}
          />
        </Field>
        <Field
          label="Como contar"
          htmlFor="national-indicator-description"
          span
          hint="Aparece para os núcleos ao informar o número. Ex.: conte só quem usa a obra diretamente, não visitantes."
        >
          <TextArea
            id="national-indicator-description"
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}

function PeopleSection() {
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
        <p className="field__hint" style={{ maxWidth: 620 }}>
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
