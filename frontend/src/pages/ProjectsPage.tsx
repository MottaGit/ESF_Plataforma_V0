import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { projectsApi, volunteersApi } from '../api/endpoints';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { LateBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Field';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '../components/ui/Icons';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ProjectDetail, ProjectListItem, ProjectStatus, Volunteer } from '../types/api';
import { PROJECT_STATUSES, formatDate, projectStatusLabel } from '../utils/format';

const sortOptions = [
  { value: 'recent', label: 'Atualizados recentemente' },
  { value: 'name', label: 'Nome (A-Z)' },
  { value: 'status', label: 'Status' },
  { value: 'deadline', label: 'Previsão de término' },
  { value: 'progress', label: 'Maior progresso' }
];

export function ProjectsPage() {
  const { canManage, isAdmin } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [onlyLate, setOnlyLate] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [dragOver, setDragOver] = useState<ProjectStatus | null>(null);

  const [formProject, setFormProject] = useState<ProjectDetail | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await projectsApi.list({
        search: debouncedSearch,
        status,
        category,
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
  }, [debouncedSearch, status, category, sort, onlyLate, includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    projectsApi.categories().then(setCategories).catch(() => undefined);
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
  }, []);

  // Abre o formulario quando a rota recebe ?novo=1 (atalho vindo do dashboard).
  useEffect(() => {
    if (searchParams.get('novo') === '1' && canManage) {
      setFormProject(null);
      setFormOpen(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canManage]);

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

  async function changeStatus(project: ProjectListItem, nextStatus: ProjectStatus) {
    if (project.status === nextStatus) return;
    try {
      await projectsApi.updateStatus(project.id, nextStatus);
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status.');
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

      <div className="toolbar">
        <div className="btn-row">
          <Button small variant={view === 'list' ? 'primary' : 'default'} onClick={() => setView('list')}>
            Lista
          </Button>
          <Button
            small
            variant={view === 'board' ? 'primary' : 'default'}
            onClick={() => {
              setView('board');
              setStatus('');
            }}
          >
            Quadro
          </Button>
        </div>

        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            placeholder="Buscar por nome, comunidade ou cidade"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar projetos"
          />
        </span>

        {view === 'list' ? (
          <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | '')} aria-label="Status">
            <option value="">Todos os status</option>
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {projectStatusLabel(value)}
              </option>
            ))}
          </Select>
        ) : null}

        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>

        <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenação">
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div className="toolbar__right">
          <label className="checkbox">
            <input type="checkbox" checked={onlyLate} onChange={(event) => setOnlyLate(event.target.checked)} />
            Só atrasados
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
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
        ) : view === 'list' ? (
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
                    <td style={{ minWidth: 240 }}>
                      <Link className="row-link" to={`/projetos/${project.id}`}>
                        {project.name}
                      </Link>
                      <div className="table__secondary">
                        {project.category}
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
                    <td style={{ minWidth: 140 }}>
                      <Progress value={project.progress} />
                    </td>
                    <td className="tight">
                      {formatDate(project.startDate)}
                      <div className="table__secondary">até {formatDate(project.endDateForecast)}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button small onClick={() => navigate(`/projetos/${project.id}`)}>
                          Abrir
                        </Button>
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
        ) : (
          <div className="kanban">
            {PROJECT_STATUSES.map((statusValue) => {
              const column = projects.filter((project) => project.status === statusValue);
              return (
                <div
                  key={statusValue}
                  className={`kanban__col${dragOver === statusValue ? ' kanban__col--over' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(statusValue);
                  }}
                  onDragLeave={() => setDragOver((current) => (current === statusValue ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);
                    const id = event.dataTransfer.getData('text/plain');
                    const project = projects.find((item) => item.id === id);
                    if (project) void changeStatus(project, statusValue);
                  }}
                >
                  <div className="kanban__head">
                    {projectStatusLabel(statusValue)}
                    <span className="kanban__count num">{column.length}</span>
                  </div>

                  {column.length === 0 ? (
                    <p className="kanban__hint">Nenhum projeto neste status.</p>
                  ) : (
                    column.map((project) => (
                      <article
                        key={project.id}
                        className="kanban__card"
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('text/plain', project.id)}
                        onClick={() => navigate(`/projetos/${project.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="kanban__card-title">{project.name}</div>
                        <div className="kanban__card-meta">
                          <span>{project.category}</span>
                          {project.isLate ? <LateBadge /> : null}
                          {project.ownerName ? <span>{project.ownerName}</span> : null}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Progress value={project.progress} />
                        </div>
                      </article>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {view === 'board' && projects.length > 0 ? (
        <p className="field__hint" style={{ marginTop: 10 }}>
          Arraste um card para mudar o status. Clique para abrir o projeto.
        </p>
      ) : null}

      {formOpen ? (
        <ProjectFormModal
          project={formProject}
          volunteers={volunteers}
          categories={categories}
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
