import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, volunteersApi } from '../api/endpoints';
import { ProgramFormModal } from '../components/programs/ProgramFormModal';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ProgramTemplateTab } from '../components/programs/ProgramTemplateTab';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { LateBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, ConfirmDialog, EmptyState, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconEdit, IconPlus } from '../components/ui/Icons';
import { Menu } from '../components/ui/Menu';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program, ProjectListItem, Volunteer } from '../types/api';
import { formatDate } from '../utils/format';
import { programProjectsSummary, programTemplateSummary } from './ProgramsPage';

/** Pagina do programa: os projetos dele e (para a coordenacao) editar, arquivar e criar projeto ja no programa. */
export function ProgramDetailPage() {
  const { id = '' } = useParams();
  const { canManage } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('aba') === 'modelo' ? 'template' : 'projects';

  const [program, setProgram] = useState<Program | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loaded, list] = await Promise.all([
        programsApi.get(id),
        projectsApi.list({ programId: id, includeArchived: true, sort: 'recent' })
      ]);
      setProgram(loaded);
      setProjects(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o programa.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    programsApi.list().then(setPrograms).catch(() => undefined);
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
  }, [canManage]);

  async function toggleArchived() {
    if (!program) return;
    const archive = program.status === 'Ativo';
    try {
      setProgram(
        await programsApi.update(program.id, {
          name: program.name,
          status: archive ? 'Arquivado' : 'Ativo',
          icon: program.icon,
          color: program.color
        })
      );
      notify(archive ? 'Programa arquivado.' : 'Programa reativado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o programa.');
    }
  }

  async function handleDelete() {
    if (!program) return;
    setBusy(true);
    try {
      await programsApi.remove(program.id);
      notify('Programa excluído.');
      navigate('/programas');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o programa.');
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Carregando programa…" />;

  if (error || !program) {
    return (
      <>
        <Alert kind="error">{error ?? 'Programa não encontrado.'}</Alert>
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/programas')}>Voltar para programas</Button>
        </div>
      </>
    );
  }

  const archived = program.status === 'Arquivado';

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to="/programas" className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          Programas
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text person-head">
          <ProgramMark icon={program.icon} color={program.color} size={48} />
          <div>
            <h1>{program.name}</h1>
            <p className="page-head__desc">
              {programProjectsSummary(program)}
              {archived ? ' · arquivado (não aparece em novos projetos)' : ''}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="page-head__actions">
            <Button icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            {!archived ? (
              <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreatingProject(true)}>
                Novo projeto
              </Button>
            ) : null}
            <Menu
              label="Mais ações do programa"
              items={[
                { label: archived ? 'Reativar programa' : 'Arquivar programa', onSelect: () => void toggleArchived() },
                ...(program.projectsCount === 0
                  ? [{ label: 'Excluir programa', danger: true, onSelect: () => setRemoving(true) }]
                  : [])
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'projects' ? ' tab--active' : ''}`}
          onClick={() => setSearchParams({}, { replace: true })}
        >
          Projetos
          <span className="tab__count num">{projects.length}</span>
        </button>
        <button
          type="button"
          className={`tab${tab === 'template' ? ' tab--active' : ''}`}
          title={programTemplateSummary(program) ?? 'Sem modelo'}
          onClick={() => setSearchParams({ aba: 'modelo' }, { replace: true })}
        >
          Modelo
          <span className="tab__count num">{program.templateActivitiesCount + program.templateIndicatorsCount}</span>
        </button>
      </div>

      {tab === 'template' ? (
        <ProgramTemplateTab
          programId={program.id}
          canEdit={canManage}
          onChanged={() => programsApi.get(program.id).then(setProgram).catch(() => undefined)}
        />
      ) : (
        <section className="panel">
          {projects.length === 0 ? (
            <EmptyState
              title="Nenhum projeto neste programa"
              description={canManage && !archived ? 'Crie o primeiro projeto já dentro do programa.' : undefined}
              action={
                canManage && !archived ? (
                  <Button variant="primary" onClick={() => setCreatingProject(true)}>
                    Novo projeto
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
                    <th className="tight">Início</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td style={{ minWidth: 210 }}>
                        <Link className="row-link" to={`/projetos/${project.id}`}>
                          {project.name}
                        </Link>
                        {project.isArchived ? <div className="table__secondary">arquivado</div> : null}
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
                      <td className="tight">{formatDate(project.startDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editing ? (
        <ProgramFormModal
          program={program}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setProgram(saved);
            notify('Programa atualizado.');
          }}
        />
      ) : null}

      {creatingProject ? (
        <ProjectFormModal
          project={null}
          initialProgramId={program.id}
          volunteers={volunteers}
          programs={programs}
          onClose={() => setCreatingProject(false)}
          onSaved={(saved) => {
            setCreatingProject(false);
            notify('Projeto criado.');
            navigate(`/projetos/${saved.id}`);
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir programa"
          message={`O programa "${program.name}" não tem projetos e será removido.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(false)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}
