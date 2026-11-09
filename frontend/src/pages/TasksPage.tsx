import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { activitiesApi, projectsApi, volunteersApi } from '../api/endpoints';
import { BlockActivityDialog } from '../components/projects/BlockActivityDialog';
import { ActivityFormModal } from '../components/projects/ActivityFormModal';
import { TaskList } from '../components/tasks/TaskList';
import { isOverdue, normalize, useJustDone, withStatus } from '../components/tasks/taskUtils';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert, LoadError, Loading } from '../components/ui/Feedback';
import { FilterSheet } from '../components/ui/FilterSheet';
import { IconBoard, IconClose, IconListBullet, IconPlus, IconSearch } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Activity, ActivityStatus, Volunteer } from '../types/api';
import { UNLINKED_MESSAGE } from '../utils/format';

// O quadro (e a biblioteca de arrastar e soltar) so e baixado quando alguem abre a visao de quadro.
const TaskBoard = lazy(() => import('../components/tasks/TaskBoard').then((module) => ({ default: module.TaskBoard })));

/** Valor do filtro de responsavel para tarefas sem ninguem atribuido. */
const UNASSIGNED = 'nenhum';

/** Situacao (filtro "Situacao" e etiqueta): cada uma mostra so as tarefas daquele tipo. */
type Cut = 'atrasadas' | 'bloqueadas' | 'concluidas';

const CUTS: Array<{ key: Cut; label: string; chip: string }> = [
  { key: 'atrasadas', label: 'Atrasadas', chip: 'Atrasadas' },
  { key: 'bloqueadas', label: 'Bloqueadas', chip: 'Bloqueadas' },
  { key: 'concluidas', label: 'Concluídas nos últimos 30 dias', chip: 'Concluídas (30 dias)' }
];

function matchesCut(activity: Activity, cut: Cut) {
  if (cut === 'atrasadas') return isOverdue(activity);
  if (cut === 'bloqueadas') return activity.status === 'Bloqueada';
  return activity.status === 'Concluida';
}

/** Etiqueta de um filtro ligado: o x aplica `clear` na URL. */
interface FilterChip {
  key: string;
  label: string;
  clear: Record<string, string | null>;
  /** A busca ja esta a mostra na barra do computador: a etiqueta dela e so do celular. */
  mobileOnly?: boolean;
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
  // Concluidas nesta visita: ficam riscadas no lugar, com "Desfazer" (igual ao Inicio e a aba do projeto).
  const justDone = useJustDone();

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

  // Links antigos: o atalho "Sem responsavel" virou a opcao do filtro Responsavel.
  useEffect(() => {
    if (searchParams.get('recorte') === 'sem-responsavel') {
      updateParams({ recorte: null, responsavel: UNASSIGNED, de: 'todas' });
    }
  }, [searchParams, updateParams]);

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
  // A recem-concluida continua a vista mesmo num recorte que ela deixou de atender (ex.: atrasadas).
  const visible = cut
    ? filtered.filter((activity) => matchesCut(activity, cut) || justDone.before.has(activity.id))
    : filtered;

  const hasFilters = Boolean(term || scopeParam || programFilter || projectFilter || assigneeFilter || cut);
  // O botao conta o que esta no painel; a busca fica a mostra no computador (no celular, vira etiqueta).
  const sheetFilters = [cut, programFilter, projectFilter, assigneeFilter].filter(Boolean).length;
  const openCount = filtered.filter((activity) => activity.status !== 'Concluida').length;
  const lateCount = filtered.filter((activity) => isOverdue(activity)).length;
  // O que a tela mostra: a lista so tem as concluidas na situacao "Concluidas"; o quadro tem a coluna delas.
  const shownCount =
    showBoard || cut === 'concluidas' ? visible.length : visible.filter((activity) => activity.status !== 'Concluida').length;
  const nameOf = (options: Array<[string, string]>, id: string) => options.find(([key]) => key === id)?.[1] ?? '';

  // Etiquetas do que esta ligado, cada uma com o x que tira o filtro.
  const chips = ([
    cut ? { key: 'recorte', label: CUTS.find((item) => item.key === cut)!.chip, clear: { recorte: null } } : null,
    programFilter
      ? { key: 'programa', label: nameOf(programOptions, programFilter) || 'Programa', clear: { programa: null, projeto: null } }
      : null,
    projectFilter
      ? {
          key: 'projeto',
          label: nameOf(projectOptions, projectFilter) || activeProjects.find((p) => p.id === projectFilter)?.name || 'Projeto',
          clear: { projeto: null }
        }
      : null,
    assigneeFilter
      ? {
          key: 'responsavel',
          label: assigneeFilter === UNASSIGNED ? 'Sem responsável' : nameOf(assigneeOptions, assigneeFilter) || 'Responsável',
          clear: { responsavel: null }
        }
      : null,
    term ? { key: 'busca', label: `"${query.trim()}"`, clear: { busca: null }, mobileOnly: true } : null
  ] as Array<FilterChip | null>).filter((chip): chip is FilterChip => chip !== null);

  const projectChoices = programFilter
    ? activeProjects.filter((project) => project.programId === programFilter)
    : activeProjects;

  /** Limpa busca e filtros; Minhas | Todas fica como esta. */
  function clearFilters() {
    setSearch('');
    updateParams({ busca: null, programa: null, projeto: null, responsavel: null, recorte: null });
  }

  const searchField = (id: string) => (
    <span className="search">
      <IconSearch className="search__icon" />
      <TextInput
        id={id}
        placeholder="Buscar tarefa ou projeto"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Buscar tarefas"
      />
    </span>
  );

  /** Bloquear pergunta antes o que esta travando; os demais status mudam direto. */
  function requestStatus(activity: Activity, status: ActivityStatus) {
    if (activity.status === status) return;
    if (status === 'Concluida') justDone.remember(activity);
    else justDone.forget(activity.id);
    if (status === 'Bloqueada') setBlocking(activity);
    else void changeStatus(activity, status);
  }

  /** Desmarcar ou "Desfazer": volta ao status de antes (com o motivo, se estava bloqueada); sem ele, nao iniciada. */
  function reopen(activity: Activity) {
    const before = justDone.before.get(activity.id);
    justDone.forget(activity.id);
    void changeStatus(activity, before?.status ?? 'AFazer', before?.blockedReason ?? null);
  }

  async function changeStatus(activity: Activity, status: ActivityStatus, blockedReason: string | null = null) {
    const replace = (next: Activity) =>
      setActivities((current) => current.map((item) => (item.id === next.id ? next : item)));

    replace(withStatus(activity, status, blockedReason));
    try {
      replace(await activitiesApi.updateStatus(activity.id, status, blockedReason));
    } catch (err) {
      replace(activity);
      if (status === 'Concluida') justDone.forget(activity.id);
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a tarefa.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Tarefas</h1>
          <p className="page-head__desc">
            {openCount} em aberto
            {lateCount > 0 ? (
              <>
                {' · '}
                <button
                  type="button"
                  className="link-button summary-line__late"
                  title={cut === 'atrasadas' ? 'Mostrar todas' : 'Mostrar só as atrasadas'}
                  onClick={() => updateParams({ recorte: cut === 'atrasadas' ? null : 'atrasadas' })}
                >
                  {lateCount} atrasada{lateCount === 1 ? '' : 's'}
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="page-head__actions">
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            Nova tarefa
          </Button>
        </div>
      </div>

      {/* Uma linha so: de quem, busca, filtros e, no canto, lista ou quadro. */}
      <div className="toolbar task-toolbar">
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

        <div className="task-toolbar__search">{searchField('task-search')}</div>

        <FilterSheet
          active={sheetFilters}
          canClear={sheetFilters > 0 || Boolean(term)}
          onClear={clearFilters}
          resultLabel={`Ver ${shownCount} ${shownCount === 1 ? 'tarefa' : 'tarefas'}`}
        >
          {/* No celular a busca nao cabe na barra: fica aqui. */}
          <div className="filter-sheet__mobile-only">
            <Field label="Buscar" htmlFor="task-search-sheet">
              {searchField('task-search-sheet')}
            </Field>
          </div>

          <Field label="Situação" htmlFor="task-cut">
            <Select id="task-cut" value={cut ?? ''} onChange={(event) => updateParams({ recorte: event.target.value || null })}>
              <option value="">Todas</option>
              {CUTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                  {item.key !== 'concluidas' ? ` (${filtered.filter((activity) => matchesCut(activity, item.key)).length})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Programa" htmlFor="task-program">
            <Select
              id="task-program"
              value={programFilter}
              onChange={(event) => updateParams({ programa: event.target.value || null, projeto: null })}
            >
              <option value="">Todos os programas</option>
              {programOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Projeto" htmlFor="task-project">
            <Select id="task-project" value={projectFilter} onChange={(event) => updateParams({ projeto: event.target.value || null })}>
              <option value="">Todos os projetos</option>
              {projectOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          {!wantsMine ? (
            <Field label="Responsável" htmlFor="task-assignee">
              <Select
                id="task-assignee"
                value={assigneeFilter}
                onChange={(event) => updateParams({ responsavel: event.target.value || null })}
              >
                <option value="">Todos os responsáveis</option>
                {assigneeOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
                <option value={UNASSIGNED}>Sem responsável</option>
              </Select>
            </Field>
          ) : null}
        </FilterSheet>

        <div className="toolbar__right">
          <div className="segmented segmented--icons" role="group" aria-label="Exibir como">
            <button
              type="button"
              className={`segmented__option${showBoard ? '' : ' segmented__option--active'}`}
              aria-pressed={!showBoard}
              aria-label="Lista"
              title="Lista"
              onClick={() => updateParams({ visao: null })}
            >
              <IconListBullet size={16} />
            </button>
            <button
              type="button"
              className={`segmented__option${showBoard ? ' segmented__option--active' : ''}`}
              aria-pressed={showBoard}
              aria-label="Quadro"
              title="Quadro"
              onClick={() => updateParams({ visao: 'quadro' })}
            >
              <IconBoard size={16} />
            </button>
          </div>
        </div>
      </div>

      {chips.length > 0 ? (
        <div
          className={`filter-chips${chips.every((chip) => chip.mobileOnly) ? ' filter-chips--mobile' : ''}`}
          role="group"
          aria-label="Filtros ligados"
        >
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`chip chip--active filter-chip${chip.mobileOnly ? ' filter-chip--mobile' : ''}`}
              title="Tirar este filtro"
              aria-label={`Tirar o filtro ${chip.label}`}
              onClick={() => {
                if (chip.key === 'busca') setSearch('');
                updateParams(chip.clear);
              }}
            >
              {chip.label}
              <IconClose size={12} />
            </button>
          ))}
          {chips.length > 1 ? (
            <button type="button" className="link-button" onClick={clearFilters}>
              Limpar tudo
            </button>
          ) : null}
        </div>
      ) : null}

      {wantsMine && !myVolunteerId ? (
        <Alert kind="info">{UNLINKED_MESSAGE}</Alert>
      ) : error ? (
        <LoadError message={error} onRetry={() => void load()} />
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
          before={justDone.before}
          onOpen={setEditing}
          onRequestStatus={requestStatus}
          onReopen={reopen}
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
