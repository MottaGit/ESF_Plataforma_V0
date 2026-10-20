import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, reportsApi, volunteersApi } from '../api/endpoints';
import { AboutTab } from '../components/projects/AboutTab';
import { ActivitiesTab } from '../components/projects/ActivitiesTab';
import { AndamentoTab } from '../components/projects/AndamentoTab';
import { FilesTab } from '../components/projects/FilesTab';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { ProjectStatusStrip } from '../components/projects/ProjectStatusStrip';
import { TeamTab } from '../components/projects/TeamTab';
import { NeutralBadge, StatusSelect } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconCalendar, IconChevronLeft, IconDownload, IconEdit } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program, ProjectDetail, ProjectStatus, Volunteer } from '../types/api';
import { deadlineLabel } from '../utils/format';
import { projectsListPath } from '../utils/listState';

type TabKey = 'updates' | 'activities' | 'team' | 'files' | 'about';

/** Nome de cada aba na URL (?aba=...), para links diretos e para recarregar sem perder a aba. */
const TAB_PARAMS: Record<TabKey, string> = {
  updates: 'andamento',
  activities: 'atividades',
  team: 'equipe',
  files: 'arquivos',
  about: 'sobre'
};

function tabFromParam(value: string | null): TabKey {
  const found = (Object.keys(TAB_PARAMS) as TabKey[]).find((key) => TAB_PARAMS[key] === value);
  return found ?? 'updates';
}

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { canManage } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = tabFromParam(searchParams.get('aba'));
  const onlyLateActivities = searchParams.get('filtro') === 'atrasadas';

  function openTab(key: TabKey, filter?: 'atrasadas') {
    const next = new URLSearchParams();
    if (key !== 'updates') next.set('aba', TAB_PARAMS[key]);
    if (filter) next.set('filtro', filter);
    setSearchParams(next, { replace: true });
  }

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProject(await projectsApi.get(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o projeto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    volunteersApi.list(undefined, true).then(setVolunteers).catch(() => undefined);
    programsApi.list().then(setPrograms).catch(() => undefined);
  }, []);

  async function changeStatus(status: ProjectStatus) {
    try {
      setProject(await projectsApi.updateStatus(id, status));
      notify('Status atualizado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o status.');
    }
  }

  async function generateReport() {
    setGenerating(true);
    try {
      await reportsApi.generate({
        projectIds: [id],
        includeVolunteers: true,
        includeIndicators: true,
        includeUpdates: true,
        includePhotos: true,
        note: null
      });
      notify('Relatório gerado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível gerar o relatório.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Loading label="Carregando projeto…" />;

  if (error || !project) {
    return (
      <>
        <Alert kind="error">{error ?? 'Projeto não encontrado.'}</Alert>
        <div style={{ marginTop: 14 }}>
          <Button onClick={() => navigate('/projetos')}>Voltar para projetos</Button>
        </div>
      </>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'updates', label: 'Andamento', count: project.updates.length },
    { key: 'activities', label: 'Atividades', count: project.activities.length },
    { key: 'team', label: 'Equipe', count: project.volunteers.length },
    { key: 'files', label: 'Arquivos', count: project.files.length },
    { key: 'about', label: 'Sobre' }
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to={projectsListPath()} className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          Projetos
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text">
          <h1>{project.name}</h1>
          <p className="page-head__desc">
            <Link className="page-head__link" to={`/programas/${project.programId}`}>
              {project.programName}
            </Link>
            {project.city ? ` · ${project.district ? `${project.district}, ` : ''}${project.city}` : ''}
            {project.ownerName ? ` · responsável: ${project.ownerName}` : ''}
          </p>
          <div className="project-head__meta">
            <StatusSelect status={project.status} onChange={(status) => void changeStatus(status)} />
            {project.isArchived ? <NeutralBadge>Arquivado</NeutralBadge> : null}
            <span className={`project-head__deadline${project.isLate ? ' project-head__deadline--late' : ''}`}>
              <IconCalendar size={14} />
              {deadlineLabel(project.endDateForecast, project.status)}
            </span>
          </div>
        </div>

        <div className="page-head__actions">
          <Button icon={<IconDownload size={15} />} loading={generating} onClick={() => void generateReport()}>
            Gerar relatório
          </Button>
          {canManage ? (
            <Button variant="primary" icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
              Editar projeto
            </Button>
          ) : null}
        </div>
      </div>

      <ProjectStatusStrip project={project} onOpenTab={openTab} />

      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => openTab(item.key)}
          >
            {item.label}
            {item.count !== undefined ? <span className="tab__count num">{item.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'updates' ? (
        <AndamentoTab project={project} onChanged={() => void load()} />
      ) : null}
      {tab === 'activities' ? (
        <ActivitiesTab
          project={project}
          volunteers={volunteers}
          onlyLate={onlyLateActivities}
          onOnlyLateChange={(value) => openTab('activities', value ? 'atrasadas' : undefined)}
          onChanged={() => void load()}
        />
      ) : null}
      {tab === 'team' ? <TeamTab project={project} onChanged={() => void load()} /> : null}
      {tab === 'files' ? <FilesTab project={project} onChanged={() => void load()} /> : null}
      {tab === 'about' ? <AboutTab project={project} canManage={canManage} onChanged={() => void load()} /> : null}

      {editing ? (
        <ProjectFormModal
          project={project}
          volunteers={volunteers}
          programs={programs}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setProject(saved);
            notify('Projeto atualizado.');
          }}
        />
      ) : null}
    </>
  );
}
