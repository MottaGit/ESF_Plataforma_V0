import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, volunteersApi } from '../api/endpoints';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { LateBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '../components/ui/Icons';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program, ProjectDetail, ProjectListItem, ProjectStatus, Volunteer } from '../types/api';
import { PROJECT_STATUSES, formatDate, projectStatusLabel } from '../utils/format';
import { rememberProjectsQuery } from '../utils/listState';

const sortOptions = [
  { value: 'recent', label: 'Atualizados recentemente' },
  { value: 'name', label: 'Nome (A-Z)' },
  { value: 'status', label: 'Status' },
  { value: 'deadline', label: 'Previsão de término' },
  { value: 'progress', label: 'Maior progresso' }
];

// O quadro (e a biblioteca de arrastar e soltar) so e baixado quando a aba e aberta.
const ActivityBoard = lazy(() =>
  import('../components/projects/ActivityBoard').then((module) => ({ default: module.ActivityBoard }))
);

type View = 'list' | 'board';

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'list', label: 'Lista de projetos' },
  { key: 'board', label: 'Quadro de atividades' }
];

/**
 * Tela de Projetos com duas visoes: a lista de projetos e o quadro com as atividades de todos os projetos
 * ativos. Visao e filtros vivem na URL: voltar de um projeto (ou recarregar) mantem a tela como estava.
 */
export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('visao') === 'quadro' ? 'board' : 'list';

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

  useEffect(() => {
    rememberProjectsQuery(searchParams.toString());
  }, [searchParams]);

  // Cada visao tem os proprios filtros: trocar de visao comeca sem filtro (e entra no historico do navegador).
  const switcher = (
    <div className="tabs">
      {VIEWS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`tab${view === item.key ? ' tab--active' : ''}`}
          aria-pressed={view === item.key}
          onClick={() => {
            if (item.key !== view) setSearchParams(item.key === 'board' ? { visao: 'quadro' } : {});
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return view === 'board' ? (
    <Suspense
      fallback={
        <>
          <div className="page-head">
            <div className="page-head__text">
              <h1>Projetos</h1>
            </div>
          </div>
          {switcher}
          <section className="panel">
            <Loading label="Carregando atividades…" />
          </section>
        </>
      }
    >
      <ActivityBoard searchParams={searchParams} updateParams={updateParams} switcher={switcher} />
    </Suspense>
  ) : (
    <ProjectList searchParams={searchParams} updateParams={updateParams} switcher={switcher} />
  );
}

interface ProjectListProps {
  searchParams: URLSearchParams;
  updateParams: (changes: Record<string, string | null>) => void;
  switcher: ReactNode;
}

function ProjectList({ searchParams, updateParams, switcher }: ProjectListProps) {
  const { canManage, isAdmin } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = searchParams.get('busca') ?? '';
  const status = (searchParams.get('status') ?? '') as ProjectStatus | '';
  const programId = searchParams.get('programa') ?? '';
  const sort = searchParams.get('ordem') ?? 'recent';
  const onlyLate = searchParams.get('atrasados') === '1';
  const includeArchived = searchParams.get('arquivados') === '1';

  const [search, setSearch] = useState(debouncedSearch);

  const [formProject, setFormProject] = useState<ProjectDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => updateParams({ busca: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [search, updateParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await projectsApi.list({
        search: debouncedSearch,
        status,
        programId,
        sort,
        onlyLate,
        includeArchived
      });
      setProjects(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os projetos.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, programId, sort, onlyLate, includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    programsApi.list().then(setPrograms).catch(() => undefined);
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
  }, []);

  // Abre o formulario quando a rota recebe ?novo=1 (atalho vindo do dashboard).
  useEffect(() => {
    if (searchParams.get('novo') === '1' && canManage) {
      setFormProject(null);
      setFormOpen(true);
      updateParams({ novo: null });
    }
  }, [searchParams, updateParams, canManage]);

  const summary = useMemo(() => {
    const late = projects.filter((project) => project.isLate).length;
    return { total: projects.length, late };
  }, [projects]);

  async function openEdit(project: ProjectListItem) {
    try {
      const detail = await projectsApi.get(project.id);
      setFormProject(detail);
      setFormOpen(true);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível abrir o projeto.');
    }
  }

  async function handleArchiveToggle(project: ProjectListItem) {
    try {
      if (project.isArchived) {
        await projectsApi.unarchive(project.id);
        notify('Projeto reativado.');
      } else {
        await projectsApi.archive(project.id);
        notify('Projeto arquivado.');
      }
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o projeto.');
    }
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await projectsApi.remove(removing.id);
      notify('Projeto excluído.');
      setRemoving(null);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o projeto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Projetos</h1>
          <p className="page-head__desc">
            {summary.total} projeto(s) na listagem
            {summary.late > 0 ? ` · ${summary.late} com prazo vencido` : ''}
          </p>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            <Button
              variant="primary"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setFormProject(null);
                setFormOpen(true);
              }}
            >
              Novo projeto
            </Button>
          </div>
        ) : null}
      </div>

      {switcher}

      <div className="toolbar">
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar por nome, comunidade ou cidade"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar projetos"
          />
        </span>

        <Select value={status} onChange={(event) => updateParams({ status: event.target.value || null })} aria-label="Status">
          <option value="">Todos os status</option>
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectStatusLabel(value)}
            </option>
          ))}
        </Select>

        <Select
          value={programId}
          onChange={(event) => updateParams({ programa: event.target.value || null })}
          aria-label="Programa"
        >
          <option value="">Todos os programas</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </Select>

        <Select
          value={sort}
          onChange={(event) => updateParams({ ordem: event.target.value === 'recent' ? null : event.target.value })}
          aria-label="Ordenação"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div className="toolbar__right">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyLate}
              onChange={(event) => updateParams({ atrasados: event.target.checked ? '1' : null })}
            />
            Só atrasados
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => updateParams({ arquivados: event.target.checked ? '1' : null })}
            />
            Incluir arquivados
          </label>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando projetos…" />
        ) : projects.length === 0 ? (
          <EmptyState
            title="Nenhum projeto encontrado"
            description="Ajuste a busca e os filtros, ou cadastre um novo projeto para começar."
            action={
              canManage ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setFormProject(null);
                    setFormOpen(true);
                  }}
                >
                  Cadastrar projeto
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Status</th>
                  <th>Responsável</th>
                  <th>Local</th>
                  <th>Progresso</th>
                  <th className="tight">Período</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td style={{ minWidth: 210 }}>
                      <Link className="row-link" to={`/projetos/${project.id}`}>
                        {project.name}
                      </Link>
                      <div className="table__secondary">
                        {project.programName}
                        {project.isArchived ? ' · arquivado' : ''}
                        {project.activitiesTotal > 0
                          ? ` · ${project.activitiesDone}/${project.activitiesTotal} atividades`
                          : ''}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={project.status} />
                      {project.isLate ? (
                        <div style={{ marginTop: 4 }}>
                          <LateBadge />
                        </div>
                      ) : null}
                    </td>
                    <td>{project.ownerName ?? '—'}</td>
                    <td>
                      {project.district ?? '—'}
                      <div className="table__secondary">{project.city ?? ''}</div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <Progress value={project.progress} />
                    </td>
                    <td className="tight">
                      {formatDate(project.startDate)}
                      <div className="table__secondary">até {formatDate(project.endDateForecast)}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canManage ? (
                          <>
                            <Button
                              small
                              variant="ghost"
                              icon={<IconEdit size={15} />}
                              title="Editar projeto"
                              aria-label="Editar projeto"
                              onClick={() => void openEdit(project)}
                            />
                            <Button small variant="ghost" onClick={() => void handleArchiveToggle(project)}>
                              {project.isArchived ? 'Reativar' : 'Arquivar'}
                            </Button>
                          </>
                        ) : null}
                        {isAdmin ? (
                          <Button
                            small
                            variant="ghost"
                            icon={<IconTrash size={15} />}
                            title="Excluir projeto"
                            aria-label="Excluir projeto"
                            onClick={() => setRemoving(project)}
                          />
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

      {formOpen ? (
        <ProjectFormModal
          project={formProject}
          volunteers={volunteers}
          programs={programs}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => {
            setFormOpen(false);
            notify(formProject ? 'Projeto atualizado.' : 'Projeto criado.');
            if (!formProject) navigate(`/projetos/${saved.id}`);
            else void load();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir projeto"
          message={`Excluir "${removing.name}" remove também atividades, indicadores, vínculos e arquivos. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}
