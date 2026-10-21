import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { activitiesApi, projectsApi, volunteersApi } from '../api/endpoints';
import { BlockActivityDialog } from '../components/projects/BlockActivityDialog';
import { ActivityFormModal } from '../components/projects/ActivityFormModal';
import { TaskList } from '../components/tasks/TaskList';
import { isOverdue, normalize, withStatus } from '../components/tasks/taskUtils';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Field';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconPlus, IconSearch } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Activity, ActivityStatus, Volunteer } from '../types/api';
import { UNLINKED_MESSAGE } from '../utils/format';

// O quadro (e a biblioteca de arrastar e soltar) so e baixado quando alguem abre a visao de quadro.
const TaskBoard = lazy(() => import('../components/tasks/TaskBoard').then((module) => ({ default: module.TaskBoard })));

/** Valor do filtro de responsavel para tarefas sem ninguem atribuido. */
const UNASSIGNED = 'nenhum';

/** Atalhos (recortes) da tela: cada um mostra so as tarefas daquele tipo. */
type Cut = 'atrasadas' | 'bloqueadas' | 'sem-responsavel' | 'concluidas';

const CUTS: Array<{ key: Cut; label: string; tone?: 'late' }> = [
  { key: 'atrasadas', label: 'Atrasadas', tone: 'late' },
  { key: 'bloqueadas', label: 'Bloqueadas' },
  { key: 'sem-responsavel', label: 'Sem responsável' },
  { key: 'concluidas', label: 'Concluídas nos últimos 30 dias' }
];

function matchesCut(activity: Activity, cut: Cut) {
  if (cut === 'atrasadas') return isOverdue(activity);
  if (cut === 'bloqueadas') return activity.status === 'Bloqueada';
  if (cut === 'sem-responsavel') return activity.status !== 'Concluida' && !activity.assignedVolunteerId;
  return activity.status === 'Concluida';
}

/** Pares [id, nome] sem repeticao, em ordem alfabetica. */
function uniqueOptions(pairs: Array<[string, string]>) {
  return [...new Map(pairs).entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

/**
 * Tarefas: todas as tarefas dos projetos em planejamento ou em andamento (e as concluidas dos ultimos 30 dias),
 * em lista (por prazo) ou em quadro (por status). Visao e filtros ficam na URL.
 */
export function TasksPage() {
  const { user, canManage } = useAuth();
  const { notify, notifyError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [activeProjects, setActiveProjects] = useState<Array<{ id: string; name: string; programId: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);
  /** Tarefa esperando o motivo do bloqueio. */
  const [blocking, setBlocking] = useState<Activity | null>(null);
  /** No celular, busca e filtros ficam recolhidos num botao. */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const myVolunteerId = user?.volunteerId ?? null;
  const showBoard = searchParams.get('visao') === 'quadro';
  // Sem escolha na URL: o voluntario comeca vendo as dele; a coordenacao, todas.
  const scopeParam = searchParams.get('de');
  const wantsMine = scopeParam ? scopeParam === 'minhas' : !canManage && Boolean(myVolunteerId);
  const mine = wantsMine && Boolean(myVolunteerId);
  const programFilter = searchParams.get('programa') ?? '';
  const projectFilter = searchParams.get('projeto') ?? '';
  const assigneeFilter = mine ? '' : (searchParams.get('responsavel') ?? '');
  const cut = (CUTS.find((item) => item.key === searchParams.get('recorte'))?.key ?? null) as Cut | null;
  const query = searchParams.get('busca') ?? '';

  const [search, setSearch] = useState(query);
  useEffect(() => {
    const timer = window.setTimeout(() => updateParams({ busca: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [search, updateParams]);

  /** silent: recarrega sem trocar a tela pelo "Carregando" (depois de salvar). */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setActivities(await activitiesApi.board());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as tarefas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
    projectsApi
      .list({ sort: 'name' })
      .then((list) =>
        setActiveProjects(
          list
            .filter((project) => project.status === 'Planejamento' || project.status === 'EmAndamento')
            .map((project) => ({ id: project.id, name: project.name, programId: project.programId }))
        )
      )
      .catch(() => undefined);
  }, []);

  const programOptions = useMemo(
    () => uniqueOptions(activities.filter((a) => a.programId).map((a) => [a.programId!, a.programName ?? 'Programa'])),
    [activities]
  );
  const projectOptions = useMemo(
    () =>
      uniqueOptions(
        activities
          .filter((a) => !programFilter || a.programId === programFilter)
          .map((a) => [a.projectId, a.projectName ?? 'Projeto'])
      ),
    [activities, programFilter]
  );
  const assigneeOptions = useMemo(
    () =>
      uniqueOptions(
        activities
          .filter((a) => a.assignedVolunteerId)
          .map((a) => [a.assignedVolunteerId!, a.assignedVolunteerName ?? 'Voluntário'])
      ),
    [activities]
  );

  // Filtros (sem o recorte): base dos numeros dos atalhos.
  const term = normalize(query.trim());
  const filtered = activities.filter((activity) => {
    if (mine && activity.assignedVolunteerId !== myVolunteerId) return false;
    if (programFilter && activity.programId !== programFilter) return false;
    if (projectFilter && activity.projectId !== projectFilter) return false;
    if (assigneeFilter === UNASSIGNED && activity.assignedVolunteerId) return false;
    if (assigneeFilter && assigneeFilter !== UNASSIGNED && activity.assignedVolunteerId !== assigneeFilter) return false;
    if (term && !normalize(`${activity.title} ${activity.projectName ?? ''}`).includes(term)) return false;
    return true;
  });
  const visible = cut ? filtered.filter((activity) => matchesCut(activity, cut)) : filtered;

  const hasFilters = Boolean(term || scopeParam || programFilter || projectFilter || assigneeFilter || cut);
  const activeFilters = [term, programFilter, projectFilter, assigneeFilter].filter(Boolean).length;
  const openCount = filtered.filter((activity) => activity.status !== 'Concluida').length;
  const lateCount = filtered.filter((activity) => isOverdue(activity)).length;

  const projectChoices = programFilter
    ? activeProjects.filter((project) => project.programId === programFilter)
    : activeProjects;

  function clearFilters() {
    setSearch('');
    updateParams({ busca: null, de: null, programa: null, projeto: null, responsavel: null, recorte: null });
  }

  /** Bloquear pergunta antes o que esta travando; os demais status mudam direto. */
  function requestStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return;
    if (status === 'Bloqueada') setBlocking(activity);
    else void changeStatus(activity, status);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null = null) {
    const replace = (next: Activity) =>
      setActivities((current) => current.map((item) => (item.id === next.id ? next : item)));

    replace(withStatus(activity, status, blockedReason));
    try {
      replace(await activitiesApi.updateStatus(activity.id, status, blockedReason));
    } catch (err) {
      replace(activity);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a tarefa.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Tarefas</h1>
          <p className="page-head__desc">
            {mine ? 'Suas tarefas' : 'Tarefas'} em aberto nos projetos em planejamento e em andamento: {openCount}
            {lateCount > 0 ? <span className="summary-line__late"> · {lateCount} atrasada{lateCount === 1 ? '' : 's'}</span> : null}
          </p>
        </div>
        <div className="page-head__actions">
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            Nova tarefa
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Exibir como">
          <button
            type="button"
            className={`segmented__option${showBoard ? '' : ' segmented__option--active'}`}
            aria-pressed={!showBoard}
            onClick={() => updateParams({ visao: null })}
          >
            Lista
          </button>
          <button
            type="button"
            className={`segmented__option${showBoard ? ' segmented__option--active' : ''}`}
            aria-pressed={showBoard}
            onClick={() => updateParams({ visao: 'quadro' })}
          >
            Quadro
          </button>
        </div>

        <div className="segmented" role="group" aria-label="De quem">
          <button
            type="button"
            className={`segmented__option${wantsMine ? ' segmented__option--active' : ''}`}
            aria-pressed={wantsMine}
            onClick={() => updateParams({ de: 'minhas', responsavel: null })}
          >
            Minhas
          </button>
          <button
            type="button"
            className={`segmented__option${wantsMine ? '' : ' segmented__option--active'}`}
            aria-pressed={!wantsMine}
            onClick={() => updateParams({ de: 'todas' })}
          >
            Todas
          </button>
        </div>

        <button
          type="button"
          className={`btn tasks-filters__toggle${activeFilters > 0 ? ' tasks-filters__toggle--on' : ''}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>

        <div className={`tasks-filters${filtersOpen ? ' tasks-filters--open' : ''}`}>
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar tarefa ou projeto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar tarefas"
          />
        </span>

        <Select
          value={programFilter}
          onChange={(event) => updateParams({ programa: event.target.value || null, projeto: null })}
          aria-label="Programa"
        >
          <option value="">Todos os programas</option>
          {programOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>

        <Select
          value={projectFilter}
          onChange={(event) => updateParams({ projeto: event.target.value || null })}
          aria-label="Projeto"
        >
          <option value="">Todos os projetos</option>
          {projectOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>

        {!wantsMine ? (
          <Select
            value={assigneeFilter}
            onChange={(event) => updateParams({ responsavel: event.target.value || null })}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            {assigneeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value={UNASSIGNED}>Sem responsável</option>
          </Select>
        ) : null}
        </div>

        {hasFilters ? (
          <div className="toolbar__right">
            <button type="button" className="link-button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
        ) : null}
      </div>

      <div className="chip-group task-cuts" role="group" aria-label="Atalhos">
        {CUTS.map((item) => {
          const count = filtered.filter((activity) => matchesCut(activity, item.key)).length;
          const active = cut === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`chip${active ? ' chip--active' : ''}${item.tone === 'late' && count > 0 ? ' chip--late' : ''}`}
              aria-pressed={active}
              onClick={() => updateParams({ recorte: active ? null : item.key })}
            >
              {item.label}
              {item.key !== 'concluidas' ? <span className="chip__count num">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {wantsMine && !myVolunteerId ? (
        <Alert kind="info">{UNLINKED_MESSAGE}</Alert>
      ) : loading ? (
        <section className="panel">
          <Loading label="Carregando tarefas…" />
        </section>
      ) : showBoard ? (
        <Suspense
          fallback={
            <section className="panel">
              <Loading label="Carregando o quadro…" />
            </section>
          }
        >
          <TaskBoard activities={visible} hasFilters={hasFilters} onOpen={setEditing} onRequestStatus={requestStatus} />
        </Suspense>
      ) : (
        <TaskList
          activities={visible}
          showDone={cut === 'concluidas'}
          hasFilters={hasFilters}
          onOpen={setEditing}
          onRequestStatus={requestStatus}
        />
      )}

      {editing ? (
        <ActivityFormModal
          projectId={editing.projectId}
          activity={editing}
          volunteers={volunteers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Tarefa atualizada.');
            void load(true);
          }}
          onExtrasChanged={() => void load(true)}
        />
      ) : null}

      {blocking ? (
        <BlockActivityDialog
          title={blocking.title}
          onCancel={() => setBlocking(null)}
          onConfirm={(reason) => {
            setBlocking(null);
            void changeStatus(blocking, 'Bloqueada', reason);
          }}
        />
      ) : null}

      {creating ? (
        <ActivityFormModal
          // Filtrando por um programa, so os projetos dele aparecem (e, se for um so, ja vem escolhido).
          projectId={projectFilter || (projectChoices.length === 1 ? projectChoices[0].id : '')}
          projects={projectChoices}
          activity={null}
          volunteers={volunteers}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify('Tarefa criada.');
            void load(true);
          }}
        />
      ) : null}
    </>
  );
}
