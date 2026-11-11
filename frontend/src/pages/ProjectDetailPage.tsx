import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, volunteersApi } from '../api/endpoints';
import { AboutTab } from '../components/projects/AboutTab';
import { ActivitiesTab } from '../components/projects/ActivitiesTab';
import { AndamentoTab } from '../components/projects/AndamentoTab';
import { CloseProjectDialog } from '../components/projects/CloseProjectDialog';
import { FilesTab } from '../components/projects/FilesTab';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { ProjectStatusStrip } from '../components/projects/ProjectStatusStrip';
import { TeamTab } from '../components/projects/TeamTab';
import { ReportDialog } from '../components/reports/ReportDialog';
import { NeutralBadge, StatusSelect } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconCalendar, IconCheck, IconChevronLeft, IconDownload, IconEdit } from '../components/ui/Icons';
import { Menu } from '../components/ui/Menu';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program, ProjectDetail, ProjectStatus, Volunteer } from '../types/api';
import { deadlineLabel, isPastProjectStatus } from '../utils/format';
import { projectsListPath } from '../utils/listState';

type TabKey = 'updates' | 'activities' | 'team' | 'files' | 'about';

/** Nome de cada aba na URL (?aba=...), para links diretos e para recarregar sem perder a aba. */
const TAB_PARAMS: Record<TabKey, string> = {
  updates: 'andamento',
  activities: 'tarefas',
  team: 'equipe',
  files: 'arquivos',
  about: 'sobre'
};

/** "Agora nao" na sugestao de concluir o projeto: guardado na sessao do navegador, por projeto. */
const closingDismissedKey = (projectId: string) => `esf.sugestao-concluir.${projectId}`;

function isClosingDismissed(projectId: string) {
  try {
    return sessionStorage.getItem(closingDismissedKey(projectId)) === '1';
  } catch {
    return false;
  }
}

function rememberClosingDismissed(projectId: string) {
  try {
    sessionStorage.setItem(closingDismissedKey(projectId), '1');
  } catch {
    // Sem armazenamento disponivel, a sugestao so some ate sair da pagina.
  }
}

function tabFromParam(value: string | null): TabKey {
  // "atividades" e o nome antigo da aba, que links ja enviados ainda usam.
  if (value === 'atividades') return 'activities';
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
  // "Registrar" (Inicio, barra do celular): abre no Andamento com o cursor no campo de registro.
  const [registering] = useState(() => searchParams.get('registrar') === '1');
  const onlyLateActivities = searchParams.get('filtro') === 'atrasadas';
  const activityAssignee = searchParams.get('responsavel') ?? '';

  /** Troca de aba; na aba Tarefas, os filtros "so atrasadas" e de responsavel vao junto na URL. */
  function openTab(key: TabKey, filter?: 'atrasadas', assignee?: string) {
    const next = new URLSearchParams();
    if (key !== 'updates') next.set('aba', TAB_PARAMS[key]);
    if (filter) next.set('filtro', filter);
    if (assignee) next.set('responsavel', assignee);
    setSearchParams(next, { replace: true });
  }

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  /** Concluir ou cancelar passa pela confirmacao (tarefas em aberto e registro de encerramento). */
  const [closing, setClosing] = useState<'Concluido' | 'Cancelado' | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

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
    if (status === 'Concluido' || status === 'Cancelado') {
      setClosing(status);
      return;
    }
    try {
      setProject(await projectsApi.updateStatus(id, status));
      notify('Status atualizado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o status.');
    }
  }

  function handleClosed(recordError: string | null) {
    if (recordError) notifyError(`O status mudou, mas o registro de encerramento não foi publicado: ${recordError}`);
    else notify(closing === 'Cancelado' ? 'Projeto cancelado.' : 'Projeto concluído.');
    setClosing(null);
    void load();
  }

  function dismissClosingSuggestion() {
    rememberClosingDismissed(id);
    setDismissedIds((current) => [...current, id]);
  }

  if (loading) return <Loading label="Carregando projeto…" />;

  if (error || !project) {
    return (
      <>
        <Alert kind="error">{error ?? 'Projeto não encontrado.'}</Alert>
        <div className="row-actions" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
          {error ? (
            <Button
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Tentar de novo
            </Button>
          ) : null}
          <Button onClick={() => navigate('/projetos')}>Voltar para projetos</Button>
        </div>
      </>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'updates', label: 'Andamento', count: project.updatesCount },
    { key: 'activities', label: 'Tarefas', count: project.activities.length },
    { key: 'team', label: 'Equipe', count: project.volunteers.length },
    { key: 'files', label: 'Arquivos', count: project.filesCount },
    { key: 'about', label: 'Sobre' }
  ];

  // Todas as tarefas concluidas e o projeto ainda aberto: sugere concluir ("Agora nao" vale ate fechar o navegador).
  const suggestClosing =
    project.activities.length > 0 &&
    project.activities.every((activity) => activity.status === 'Concluida') &&
    !isPastProjectStatus(project.status) &&
    !dismissedIds.includes(project.id) &&
    !isClosingDismissed(project.id);

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
            <Link className="page-head__link" to={`/projetos?programa=${project.programId}`}>
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
              {deadlineLabel(project.endDateForecast, project.status, project.closedOn)}
            </span>
          </div>
        </div>

        <div className="page-head__actions">
          {/* No celular, com o Editar ao lado, o relatorio vai para o "..." e sobra espaco para o conteudo. */}
          <Button
            className={canManage ? 'only-desktop' : undefined}
            icon={<IconDownload size={15} />}
            onClick={() => setReporting(true)}
          >
            Gerar relatório
          </Button>
          {canManage ? (
            <>
              <Button variant="primary" icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
                Editar projeto
              </Button>
              <span className="only-mobile">
                <Menu
                  label={`Mais ações de ${project.name}`}
                  items={[{ label: 'Gerar relatório', icon: <IconDownload size={14} />, onSelect: () => setReporting(true) }]}
                />
              </span>
            </>
          ) : null}
        </div>
      </div>

      <ProjectStatusStrip project={project} canManage={canManage} onOpenTab={openTab} onChanged={() => void load()} />

      {suggestClosing ? (
        <div className="closing-notice" role="status">
          <IconCheck size={18} />
          <span className="closing-notice__text">
            Todas as tarefas estão concluídas. Se a entrega foi feita, conclua o projeto.
          </span>
          <div className="closing-notice__actions">
            <Button small variant="ghost" onClick={dismissClosingSuggestion}>
              Agora não
            </Button>
            <Button small variant="primary" onClick={() => setClosing('Concluido')}>
              Concluir projeto
            </Button>
          </div>
        </div>
      ) : null}

      <ScrollTabs activeKey={tab}>
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
      </ScrollTabs>

      {tab === 'updates' ? (
        <AndamentoTab project={project} onChanged={() => void load()} onOpenTab={openTab} focusComposer={registering} />
      ) : null}
      {tab === 'activities' ? (
        <ActivitiesTab
          project={project}
          volunteers={volunteers}
          onlyLate={onlyLateActivities}
          assignee={activityAssignee}
          onUrlFiltersChange={(filters) =>
            openTab('activities', filters.onlyLate ? 'atrasadas' : undefined, filters.assignee)
          }
          onChanged={() => void load()}
        />
      ) : null}
      {tab === 'team' ? (
        <TeamTab
          project={project}
          onOpenTasks={(volunteerId) => openTab('activities', undefined, volunteerId)}
          onChanged={() => void load()}
        />
      ) : null}
      {tab === 'files' ? <FilesTab project={project} onChanged={() => void load()} /> : null}
      {tab === 'about' ? <AboutTab project={project} canManage={canManage} onChanged={() => void load()} /> : null}

      {reporting ? <ReportDialog project={project} onClose={() => setReporting(false)} /> : null}

      {closing ? (
        <CloseProjectDialog
          project={project}
          status={closing}
          onCancel={() => setClosing(null)}
          onClosed={handleClosed}
          onOpenTasks={() => {
            setClosing(null);
            openTab('activities');
          }}
        />
      ) : null}

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
