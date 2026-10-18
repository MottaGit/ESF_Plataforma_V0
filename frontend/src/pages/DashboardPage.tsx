import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { activitiesApi, dashboardApi, volunteersApi } from '../api/endpoints';
import { Avatar } from '../components/ui/Avatar';
import { BirthdayBadge, LateBadge, NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { IconPlus } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import type { Activity, Dashboard, Volunteer, VolunteerWorkload } from '../types/api';
import { MONTH_NAMES, daysFromToday, displayName, dueLabel, isBirthdayToday } from '../utils/format';

/** Recortes do bloco "Precisa de atencao". */
type AttentionFilter = 'all' | 'late' | 'soon' | 'unassigned';

const ATTENTION_FILTERS: Array<{ key: AttentionFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'late', label: 'Atrasadas' },
  { key: 'soon', label: 'Próximos 7 dias' },
  { key: 'unassigned', label: 'Sem responsável' }
];

/** Quantas atividades aparecem antes do "Mostrar todas". */
const ATTENTION_VISIBLE = 8;

function isDueSoon(activity: Activity) {
  if (!activity.dueDate || activity.isLate) return false;
  return daysFromToday(activity.dueDate) <= 7;
}

function matchesFilter(activity: Activity, filter: AttentionFilter) {
  if (filter === 'late') return activity.isLate;
  if (filter === 'soon') return isDueSoon(activity);
  if (filter === 'unassigned') return !activity.assignedVolunteerId;
  return true;
}

export function DashboardPage() {
  const { canManage, user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const attentionRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.get());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a visão geral.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Carregando a visão geral…" />;

  if (error) {
    return (
      <Alert kind="error">
        {error} <button className="btn btn--sm" style={{ marginLeft: 10 }} onClick={() => void load()}>Tentar de novo</button>
      </Alert>
    );
  }

  if (!data) return null;

  const { totals, attention, workload, upcomingActivities } = data;
  const firstName = displayName(user).split(' ')[0];

  /** Os numeros do topo levam ao recorte correspondente em "Precisa de atencao". */
  function showAttention(filter: AttentionFilter) {
    setAttentionFilter(filter);
    attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Olá, {firstName}</h1>
          <p className="page-head__desc">
            <SummaryLine data={data} />
          </p>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => navigate('/projetos?novo=1')}>
              Novo projeto
            </Button>
          </div>
        ) : null}
      </div>

      <div className="stat-strip section">
        <button type="button" className="stat stat--link" onClick={() => showAttention('late')}>
          <div className={`stat__value num${totals.lateActivities > 0 ? ' stat__value--alert' : ''}`}>
            {totals.lateActivities}
          </div>
          <div className="stat__label">Atividades atrasadas</div>
          <div className="stat__hint">Prazo já passou</div>
        </button>
        <button type="button" className="stat stat--link" onClick={() => showAttention('soon')}>
          <div className="stat__value num">{totals.dueSoonActivities}</div>
          <div className="stat__label">Vencem nos próximos 7 dias</div>
          <div className="stat__hint">Ainda dá tempo</div>
        </button>
        <div className="stat">
          <div className="stat__value num">{totals.inProgressActivities}</div>
          <div className="stat__label">Atividades em andamento</div>
          <div className="stat__hint">Em execução agora</div>
        </div>
        <Link className="stat stat--link" to="/voluntarios">
          <div className="stat__value num">{totals.activeVolunteers}</div>
          <div className="stat__label">Voluntários ativos</div>
          <div className="stat__hint">
            {totals.activeVolunteersWithoutOpenActivities === 0
              ? 'Todos com atividade em aberto'
              : `${totals.activeVolunteersWithoutOpenActivities} sem nenhuma atividade em aberto`}
          </div>
        </Link>
      </div>

      <div className="grid-sidebar">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <AttentionPanel
            panelRef={attentionRef}
            activities={attention}
            filter={attentionFilter}
            onFilterChange={setAttentionFilter}
          />
          <TeamPanel workload={workload} idle={totals.activeVolunteersWithoutOpenActivities} />
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <UpcomingActivitiesPanel all={upcomingActivities} />
          <BirthdaysPanel />
        </div>
      </div>
    </>
  );
}

/** "1 atividade" / "3 atividades" e afins. */
function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Resumo de uma linha no cabecalho: as atividades da propria pessoa quando o acesso esta vinculado
 * a um voluntario; senao, o panorama da organizacao.
 */
function SummaryLine({ data }: { data: Dashboard }) {
  const { mine, totals } = data;

  if (mine) {
    if (mine.open === 0) return <>Você não tem atividades em aberto.</>;
    return (
      <>
        Você tem {plural(mine.open, 'atividade em aberto', 'atividades em aberto')}
        {mine.late > 0 ? (
          <>
            {' · '}
            <span className="summary-line__late">{plural(mine.late, 'atrasada', 'atrasadas')}</span>
          </>
        ) : null}
        {mine.dueSoon > 0
          ? ` · ${mine.dueSoon} ${mine.dueSoon === 1 ? 'vence' : 'vencem'} nos próximos 7 dias`
          : null}
      </>
    );
  }

  if (totals.lateActivities === 0 && totals.dueSoonActivities === 0)
    return <>Nenhuma atividade atrasada ou vencendo nos próximos dias na organização.</>;

  return (
    <>
      Na organização:{' '}
      {totals.lateActivities > 0 ? (
        <span className="summary-line__late">
          {plural(totals.lateActivities, 'atividade atrasada', 'atividades atrasadas')}
        </span>
      ) : null}
      {totals.lateActivities > 0 && totals.dueSoonActivities > 0 ? ' · ' : null}
      {totals.dueSoonActivities > 0
        ? `${totals.dueSoonActivities} ${totals.dueSoonActivities === 1 ? 'vence' : 'vencem'} nos próximos 7 dias`
        : null}
    </>
  );
}

interface AttentionPanelProps {
  activities: Activity[];
  filter: AttentionFilter;
  onFilterChange: (filter: AttentionFilter) => void;
  panelRef: Ref<HTMLElement>;
}

/** Atividades que pedem acao agora: atrasadas, vencendo em ate 7 dias ou sem responsavel. */
function AttentionPanel({ activities, filter, onFilterChange, panelRef }: AttentionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const filtered = activities.filter((activity) => matchesFilter(activity, filter));
  const visible = expanded ? filtered : filtered.slice(0, ATTENTION_VISIBLE);

  return (
    <section className="panel attention" ref={panelRef}>
      <div className="panel__head">
        <h2>Precisa de atenção</h2>
      </div>
      <div className="attention__filters" role="group" aria-label="Filtrar atividades">
        {ATTENTION_FILTERS.map((item) => {
          const count = activities.filter((activity) => matchesFilter(activity, item.key)).length;
          return (
            <button
              key={item.key}
              type="button"
              className={`chip${filter === item.key ? ' chip--active' : ''}`}
              aria-pressed={filter === item.key}
              onClick={() => {
                onFilterChange(item.key);
                setExpanded(false);
              }}
            >
              {item.label}
              <span className="chip__count num">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nada pedindo atenção"
          description={
            filter === 'all'
              ? 'Nenhuma atividade atrasada, vencendo nos próximos dias ou sem responsável.'
              : 'Nenhuma atividade neste recorte.'
          }
        />
      ) : (
        <ul className="attention__list">
          {visible.map((activity) => (
            <li key={activity.id} className="attention__item">
              <div className="attention__main">
                <Link
                  className="row-link attention__title"
                  to={`/projetos/${activity.projectId}?aba=atividades${activity.isLate ? '&filtro=atrasadas' : ''}`}
                >
                  {activity.title}
                </Link>
                <div className="attention__meta">
                  <span>{activity.projectName}</span>
                  <span>{activity.assignedVolunteerName ?? 'Sem responsável'}</span>
                </div>
              </div>
              <div className="attention__reasons">
                {activity.isLate ? (
                  <LateBadge label={dueLabel(activity.dueDate)} />
                ) : isDueSoon(activity) ? (
                  <span className="badge badge--pause">vence {dueLabel(activity.dueDate)}</span>
                ) : null}
                {!activity.assignedVolunteerId ? <NeutralBadge>sem responsável</NeutralBadge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > ATTENTION_VISIBLE ? (
        <div className="attention__more">
          <button type="button" className="link-button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Mostrar menos' : `Mostrar todas (${filtered.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Carga da equipe: quem esta com mais atividades em aberto, e quantos ativos estao sem nenhuma. */
function TeamPanel({ workload, idle }: { workload: VolunteerWorkload[]; idle: number }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Equipe</h2>
        <div className="panel__actions">
          <Link className="btn btn--sm" to="/voluntarios">
            Ver voluntários
          </Link>
        </div>
      </div>
      <div className="panel__body">
        {workload.length === 0 ? (
          <p className="field__hint">Ninguém está com atividades em aberto.</p>
        ) : (
          <ul className="team-load">
            {workload.map((item) => (
              <li key={item.volunteerId} className="team-load__item">
                <Avatar name={item.name} photoUrl={item.photoUrl} size={28} />
                <Link className="row-link team-load__name" to={`/voluntarios/${item.volunteerId}`}>
                  {item.name}
                </Link>
                <span className="team-load__count num">
                  {item.openActivities} em aberto
                  {item.lateActivities > 0 ? (
                    <span className="team-load__late">
                      {' · '}
                      {item.lateActivities} {item.lateActivities > 1 ? 'atrasadas' : 'atrasada'}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {idle > 0 ? (
          <p className="field__hint" style={{ marginTop: 12 }}>
            {idle === 1
              ? '1 voluntário ativo está sem nenhuma atividade em aberto.'
              : `${idle} voluntários ativos estão sem nenhuma atividade em aberto.`}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Proximas atividades com o recorte "Minhas" (atribuidas ao voluntario vinculado ao usuario logado)
 * ou "Todas" (da organizacao). Abre em "Minhas" quando o usuario tem voluntario vinculado.
 */
function UpcomingActivitiesPanel({ all }: { all: Activity[] }) {
  const { user } = useAuth();
  const linked = Boolean(user?.volunteerId);

  const [scope, setScope] = useState<'mine' | 'all'>(linked ? 'mine' : 'all');
  const [mine, setMine] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scope !== 'mine' || !linked || mine) return;
    activitiesApi
      .upcoming(6, true)
      .then(setMine)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar suas atividades.'));
  }, [scope, linked, mine]);

  const activities = scope === 'mine' ? mine : all;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Próximas atividades</h2>
        <div className="panel__actions btn-row">
          <Button small variant={scope === 'mine' ? 'primary' : 'default'} onClick={() => setScope('mine')}>
            Minhas
          </Button>
          <Button small variant={scope === 'all' ? 'primary' : 'default'} onClick={() => setScope('all')}>
            Todas
          </Button>
        </div>
      </div>
      <div className="panel__body">
        {scope === 'mine' && !linked ? (
          <Alert kind="info">
            Seu acesso ainda não está vinculado a um voluntário, então não dá para saber quais atividades são suas. Peça
            a um administrador para fazer o vínculo em Configurações › Usuários.
          </Alert>
        ) : error && scope === 'mine' ? (
          <Alert kind="error">{error}</Alert>
        ) : activities === null ? (
          <Loading label="Carregando suas atividades…" />
        ) : activities.length === 0 ? (
          <EmptyState
            title="Nada pendente"
            description={
              scope === 'mine'
                ? 'Você não tem atividades em aberto.'
                : 'Todas as atividades registradas estão concluídas.'
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {activities.map((activity) => (
              <div key={activity.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{activity.title}</div>
                  <div className="table__secondary">
                    <Link to={`/projetos/${activity.projectId}?aba=atividades`}>{activity.projectName}</Link>
                    {scope === 'all' && activity.assignedVolunteerName ? ` · ${activity.assignedVolunteerName}` : ''}
                  </div>
                </div>
                <span className={`badge ${activity.isLate ? 'badge--late' : 'badge--neutral'}`}>
                  {dueLabel(activity.dueDate)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Aniversariantes do mes (pela data local de quem esta usando), so de quem ainda faz parte da
 * organizacao (ativos e afastados). O aniversariante do dia fica destacado.
 */
function BirthdaysPanel() {
  const [volunteers, setVolunteers] = useState<Volunteer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    volunteersApi
      .list()
      .then(setVolunteers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os aniversários.'));
  }, []);

  const today = new Date();
  const month = today.getMonth() + 1;
  const people = (volunteers ?? [])
    .filter((volunteer) => volunteer.birthMonth === month && volunteer.birthDay)
    .filter((volunteer) => volunteer.status === 'Ativo' || volunteer.status === 'Afastado')
    .sort((a, b) => (a.birthDay ?? 0) - (b.birthDay ?? 0) || a.name.localeCompare(b.name));

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Aniversariantes de {MONTH_NAMES[month - 1]}</h2>
      </div>
      <div className="panel__body">
        {error ? (
          <Alert kind="error">{error}</Alert>
        ) : volunteers === null ? (
          <Loading label="Carregando aniversários…" />
        ) : people.length === 0 ? (
          <p className="field__hint">Ninguém faz aniversário em {MONTH_NAMES[month - 1]}.</p>
        ) : (
          <ul className="birthday-list">
            {people.map((volunteer) => {
              const isToday = isBirthdayToday(volunteer.birthDay, volunteer.birthMonth);
              const passed = !isToday && (volunteer.birthDay ?? 0) < today.getDate();
              return (
                <li
                  key={volunteer.id}
                  className={`birthday-list__item${isToday ? ' birthday-list__item--today' : ''}${passed ? ' birthday-list__item--passed' : ''}`}
                >
                  <Avatar name={volunteer.name} photoUrl={volunteer.photoUrl} size={30} />
                  <Link className="row-link birthday-list__name" to={`/voluntarios/${volunteer.id}`}>
                    {volunteer.name}
                  </Link>
                  {isToday ? (
                    <BirthdayBadge />
                  ) : (
                    <span className="birthday-list__day num">dia {volunteer.birthDay}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
