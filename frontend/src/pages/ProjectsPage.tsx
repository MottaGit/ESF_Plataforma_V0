import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, volunteersApi } from '../api/endpoints';
import { ProgramFormModal } from '../components/programs/ProgramFormModal';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ProgramPicker } from '../components/programs/ProgramPicker';
import { PublicPageDialog } from '../components/programs/PublicPageDialog';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CollapsibleFilters } from '../components/ui/CollapsibleFilters';
import { Select, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { ExportSpreadsheetDialog } from '../components/spreadsheets/ExportSpreadsheetDialog';
import { IconDownload, IconEdit, IconGlobe, IconListBullet, IconMapPin, IconPlus, IconSearch, IconTrash } from '../components/ui/Icons';
import { Menu } from '../components/ui/Menu';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program, ProjectDetail, ProjectListItem, ProjectStatus, Volunteer } from '../types/api';
import { PROJECT_STATUSES, coverageLabel, formatDateTime, formatNumber, projectStatusLabel, timeAgo } from '../utils/format';
import { rememberProjectsQuery } from '../utils/listState';

const sortOptions = [
  { value: 'recent', label: 'Atualizados recentemente' },
  { value: 'name', label: 'Nome (A-Z)' },
  { value: 'status', label: 'Status' },
  { value: 'deadline', label: 'Previsão de término' },
  { value: 'progress', label: 'Maior progresso' }
];

// O mapa (Leaflet) so e baixado quando alguem abre a visao de mapa.
const ProjectsMap = lazy(() =>
  import('../components/map/ProjectsMap').then((module) => ({ default: module.ProjectsMap }))
);

/**
 * Tela de Projetos, organizada por programa: a lista de programas (com icone, busca e arquivados) escolhe entre todos
 * os projetos e um programa so, que mostra a visao geral dele (resultados somados, modelo) e os projetos dele. Filtros vivem na URL: voltar de um projeto (ou recarregar)
 * mantem a tela como estava.
 */
export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

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

  // O quadro de tarefas mudou para Tarefas: links antigos (?visao=quadro) vao para la com os mesmos filtros.
  if (searchParams.get('visao') === 'quadro') {
    return <Navigate to={`/tarefas?${searchParams.toString()}`} replace />;
  }

  return <ProjectList searchParams={searchParams} updateParams={updateParams} />;
}

interface ProjectListProps {
  searchParams: URLSearchParams;
  updateParams: (changes: Record<string, string | null>) => void;
}

function ProjectList({ searchParams, updateParams }: ProjectListProps) {
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
  // Vindo do Inicio: so os projetos em andamento sem registro ha mais de 30 dias.
  const onlyStale = searchParams.get('parados') === '1';
  // Lista ou mapa: os mesmos filtros valem para os dois.
  const showMap = searchParams.get('exibir') === 'mapa';
  const focusId = searchParams.get('foco');

  const [search, setSearch] = useState(debouncedSearch);
  // A ordenacao nao conta como filtro.
  const activeFilters = [debouncedSearch, status, onlyLate, includeArchived].filter(Boolean).length;

  const [formProject, setFormProject] = useState<ProjectDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [programForm, setProgramForm] = useState<Program | 'new' | null>(null);
  const [removingProgram, setRemovingProgram] = useState<Program | null>(null);
  const [publicPageProgram, setPublicPageProgram] = useState<Program | null>(null);
  const [exporting, setExporting] = useState(false);

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
        onlyStale,
        includeArchived
      });
      setProjects(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os projetos.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, programId, sort, onlyLate, onlyStale, includeArchived]);

  const loadPrograms = useCallback(() => {
    programsApi
      .list(false)
      .then(setPrograms)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    loadPrograms();
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
  }, [loadPrograms]);

  // Abre o formulario quando a rota recebe ?novo=1.
  useEffect(() => {
    if (searchParams.get('novo') === '1' && canManage) {
      setFormProject(null);
      setFormOpen(true);
      updateParams({ novo: null });
    }
  }, [searchParams, updateParams, canManage]);

  const activePrograms = programs.filter((program) => program.status === 'Ativo');
  const selected = programs.find((program) => program.id === programId) ?? null;

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
      loadPrograms();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o projeto.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleProgramArchived(program: Program) {
    const archive = program.status === 'Ativo';
    try {
      await programsApi.update(program.id, {
        name: program.name,
        status: archive ? 'Arquivado' : 'Ativo',
        icon: program.icon,
        color: program.color
      });
      notify(archive ? 'Programa arquivado.' : 'Programa reativado.');
      loadPrograms();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o programa.');
    }
  }

  async function handleDeleteProgram() {
    if (!removingProgram) return;
    setBusy(true);
    try {
      await programsApi.remove(removingProgram.id);
      notify('Programa excluído.');
      setRemovingProgram(null);
      updateParams({ programa: null });
      loadPrograms();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o programa.');
    } finally {
      setBusy(false);
    }
  }

  function openNewProject() {
    setFormProject(null);
    setFormOpen(true);
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Projetos</h1>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            {isAdmin ? (
              <Button icon={<IconDownload size={15} />} onClick={() => setExporting(true)}>
                Exportar
              </Button>
            ) : null}
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={openNewProject}>
              Novo projeto
            </Button>
          </div>
        ) : null}
      </div>

      {/* Programa, busca e status numa linha so; a visao geral do programa escolhido vem logo abaixo. */}
      <div className="toolbar">
        <ProgramPicker
          programs={programs}
          selectedId={programId}
          onSelect={(id) => updateParams({ programa: id })}
          onCreate={canManage ? () => setProgramForm('new') : undefined}
        />

        <CollapsibleFilters active={activeFilters}>
          <span className="search">
            <IconSearch className="search__icon" />
            <TextInput
              placeholder={selected ? 'Buscar neste programa' : 'Buscar por nome, comunidade ou cidade'}
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

          {!showMap ? (
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
          ) : null}

          <div className="toolbar__chips" role="group" aria-label="Mais filtros">
            <button
              type="button"
              className={`chip${onlyLate ? ' chip--active' : ''}`}
              aria-pressed={onlyLate}
              onClick={() => updateParams({ atrasados: onlyLate ? null : '1' })}
            >
              Só atrasados
            </button>
            <button
              type="button"
              className={`chip${includeArchived ? ' chip--active' : ''}`}
              aria-pressed={includeArchived}
              onClick={() => updateParams({ arquivados: includeArchived ? null : '1' })}
            >
              Incluir arquivados
            </button>
          </div>
        </CollapsibleFilters>

        <div className="toolbar__right">
          <div className="segmented" role="group" aria-label="Exibir como">
            <button
              type="button"
              className={`segmented__option${showMap ? '' : ' segmented__option--active'}`}
              aria-pressed={!showMap}
              onClick={() => updateParams({ exibir: null, foco: null })}
            >
              <IconListBullet size={15} />
              Lista
            </button>
            <button
              type="button"
              className={`segmented__option${showMap ? ' segmented__option--active' : ''}`}
              aria-pressed={showMap}
              onClick={() => updateParams({ exibir: 'mapa' })}
            >
              <IconMapPin size={15} />
              Mapa
            </button>
          </div>
        </div>
      </div>

      {onlyStale ? (
        <div className="chip-group" style={{ margin: '-4px 0 14px' }}>
          <button type="button" className="chip chip--active" onClick={() => updateParams({ parados: null })}>
            Só os parados (em andamento, sem registro há 30 dias)
            <span aria-hidden="true">×</span>
            <span className="sr-only">Tirar este filtro</span>
          </button>
        </div>
      ) : null}

      {selected ? (
        <ProgramOverview
          program={selected}
          canManage={canManage}
          onEdit={() => setProgramForm(selected)}
          onPublicPage={() => setPublicPageProgram(selected)}
          onToggleArchived={() => void toggleProgramArchived(selected)}
          onDelete={() => setRemovingProgram(selected)}
        />
      ) : null}

      {error ? <Alert kind="error">{error}</Alert> : null}

      {showMap && !loading ? (
        <Suspense
          fallback={
            <section className="panel">
              <Loading label="Carregando mapa…" />
            </section>
          }
        >
          <ProjectsMap projects={projects} focusId={focusId} />
        </Suspense>
      ) : (
        <section className="panel">
          {loading ? (
            <Loading label="Carregando projetos…" />
          ) : projects.length === 0 ? (
            <EmptyState
              title="Nenhum projeto encontrado"
              description="Ajuste a busca e os filtros, ou cadastre um novo projeto para começar."
              action={
                canManage ? (
                  <Button variant="primary" onClick={openNewProject}>
                    Cadastrar projeto
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table table--cards">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th>Status</th>
                      <th>Responsável</th>
                      <th>Progresso</th>
                      <th>Último registro</th>
                      {canManage ? (
                        <th className="right">
                          <span className="sr-only">Ações</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td className="cell--main" style={{ minWidth: 220 }}>
                          <div className="project-cell">
                            {!selected ? (
                              <ProgramMark icon={project.programIcon} color={project.programColor} size={24} />
                            ) : null}
                            <div>
                              <Link className="row-link" to={`/projetos/${project.id}`}>
                                {project.name}
                              </Link>
                              <div className="table__secondary">
                                {[!selected ? project.programName : null, project.district, project.isArchived ? 'arquivado' : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                                {/* Atraso em texto vermelho, como o prazo das tarefas: o status fica num selo so. */}
                                {project.isLate ? <span className="late-text"> · prazo vencido</span> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="cell--desktop">{project.ownerName ?? '—'}</td>
                        <td className="cell--grow" style={{ minWidth: 120 }}>
                          <Progress value={project.progress} />
                        </td>
                        <td className="tight" data-label={project.lastUpdateAt ? 'último registro' : undefined}>
                          {project.lastUpdateAt ? (
                            <span title={formatDateTime(project.lastUpdateAt)}>{timeAgo(project.lastUpdateAt)}</span>
                          ) : (
                            <span className="table__secondary">sem registro</span>
                          )}
                        </td>
                        {canManage ? (
                          <td className="cell--actions">
                            <div className="row-actions">
                              <Menu
                                label={`Ações de ${project.name}`}
                                items={[
                                  { label: 'Editar', icon: <IconEdit size={14} />, onSelect: () => void openEdit(project) },
                                  {
                                    label: project.isArchived ? 'Reativar' : 'Arquivar',
                                    onSelect: () => void handleArchiveToggle(project)
                                  },
                                  ...(isAdmin
                                    ? [
                                        {
                                          label: 'Excluir',
                                          icon: <IconTrash size={14} />,
                                          danger: true,
                                          onSelect: () => setRemoving(project)
                                        }
                                      ]
                                    : [])
                                ]}
                              />
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-foot">
                {summary.total} {summary.total === 1 ? 'projeto' : 'projetos'}
                {summary.late > 0 ? ` · ${summary.late} com prazo vencido` : ''}
              </p>
            </>
          )}
        </section>
      )}

      {formOpen ? (
        <ProjectFormModal
          project={formProject}
          initialProgramId={!formProject && selected?.status === 'Ativo' ? selected.id : undefined}
          volunteers={volunteers}
          programs={activePrograms}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => {
            setFormOpen(false);
            notify(formProject ? 'Projeto atualizado.' : 'Projeto criado.');
            if (!formProject) navigate(`/projetos/${saved.id}`);
            else void load();
          }}
        />
      ) : null}

      {publicPageProgram ? (
        <PublicPageDialog
          program={publicPageProgram}
          onClose={() => setPublicPageProgram(null)}
          onChanged={() => loadPrograms()}
        />
      ) : null}

      {programForm ? (
        <ProgramFormModal
          program={programForm === 'new' ? null : programForm}
          onClose={() => setProgramForm(null)}
          onSaved={(saved) => {
            setProgramForm(null);
            notify(programForm === 'new' ? 'Programa criado.' : 'Programa atualizado.');
            loadPrograms();
            updateParams({ programa: saved.id });
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir projeto"
          message={`Excluir "${removing.name}" remove também tarefas, indicadores, vínculos e arquivos. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {removingProgram ? (
        <ConfirmDialog
          title="Excluir programa"
          message={`O programa "${removingProgram.name}" não tem projetos e será removido.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemovingProgram(null)}
          onConfirm={() => void handleDeleteProgram()}
        />
      ) : null}

      {exporting ? <ExportSpreadsheetDialog initial={{ projects: true, volunteers: false }} onClose={() => setExporting(false)} /> : null}
    </>
  );
}

interface ProgramOverviewProps {
  program: Program;
  canManage: boolean;
  onEdit: () => void;
  onPublicPage: () => void;
  onToggleArchived: () => void;
  onDelete: () => void;
}

/** Visao do programa escolhido: numeros, resultados somados e (para a coordenacao) modelo e edicao. */
function ProgramOverview({ program, canManage, onEdit, onPublicPage, onToggleArchived, onDelete }: ProgramOverviewProps) {
  const archived = program.status === 'Arquivado';
  const numbers = [
    {
      key: 'active',
      value: String(program.activeProjectsCount),
      label: program.activeProjectsCount === 1 ? 'ativo' : 'ativos',
      title: 'Em planejamento, em andamento ou pausados' as string | undefined,
      note: null as string | null
    },
    {
      key: 'done',
      value: String(program.doneProjectsCount),
      label: program.doneProjectsCount === 1 ? 'concluído' : 'concluídos',
      title: undefined as string | undefined,
      note: null as string | null
    },
    // Resultados pela regra unica: "—" quando nenhum projeto informou (nao e zero).
    ...program.results.map((result) => ({
      key: `r-${result.name}`,
      value: result.total == null ? '—' : formatNumber(result.total),
      label: result.name,
      title: result.name as string | undefined,
      note: result.total == null ? 'não informado' : coverageLabel(result.informed, result.projects)
    }))
  ];

  return (
    <section className="panel program-overview" aria-label={program.name}>
      <div className="program-overview__head">
        <ProgramMark icon={program.icon} color={program.color} size={44} />
        <div className="program-overview__title">
          <h2>{program.name}</h2>
          <span className="field__hint">
            {archived
              ? 'Programa arquivado: não aparece em novos projetos.'
              : `${program.projectsCount} ${program.projectsCount === 1 ? 'projeto' : 'projetos'} no programa`}
            {canManage && program.publicPage ? ' · página pública ligada' : ''}
          </span>
        </div>
        {canManage ? (
          <div className="program-overview__actions">
            <Link className="btn" to={`/programas/${program.id}/modelo`}>
              Modelo do programa
            </Link>
            <Button icon={<IconEdit size={15} />} onClick={onEdit}>
              Editar
            </Button>
            <Button icon={<IconGlobe size={15} />} onClick={onPublicPage}>
              Página pública
            </Button>
            <Menu
              label="Mais ações do programa"
              items={[
                { label: archived ? 'Reativar programa' : 'Arquivar programa', onSelect: onToggleArchived },
                ...(program.projectsCount === 0 ? [{ label: 'Excluir programa', danger: true, onSelect: onDelete }] : [])
              ]}
            />
          </div>
        ) : null}
      </div>
      <div className="program-overview__numbers">
        {numbers.map((item) => (
          <div key={item.key} className="program-overview__number" title={item.title}>
            <b className="num">{item.value}</b>
            <span>{item.label}</span>
            {item.note ? <span className="program-overview__coverage">{item.note}</span> : null}
          </div>
        ))}
      </div>
      {program.results.length > 0 ? (
        <p className="field__hint program-overview__note">
          Resultados: os indicadores nacionais e os do modelo, somados nos projetos do programa (só o que foi
          informado; arquivados entram, cancelados não).
          {canManage && !program.results.some((result) => !result.national) ? (
            <>
              {' '}
              Para somar outros resultados, inclua indicadores padrão no{' '}
              <Link to={`/programas/${program.id}/modelo`}>modelo do programa</Link>.
            </>
          ) : null}
        </p>
      ) : canManage ? (
        <p className="field__hint program-overview__note">
          Para ver resultados somados aqui, inclua indicadores padrão no{' '}
          <Link to={`/programas/${program.id}/modelo`}>modelo do programa</Link>.
        </p>
      ) : null}
    </section>
  );
}
