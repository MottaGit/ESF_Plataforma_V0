import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { projectsApi, reportsApi, usersApi } from '../api/endpoints';
import { ActivitiesTab } from '../components/projects/ActivitiesTab';
import { FilesTab } from '../components/projects/FilesTab';
import { IndicatorsTab } from '../components/projects/IndicatorsTab';
import { LocationTab } from '../components/projects/LocationTab';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { VolunteersTab } from '../components/projects/VolunteersTab';
import { LateBadge, NeutralBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconDownload, IconEdit } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ProjectDetail, ProjectStatus, User } from '../types/api';
import { PROJECT_STATUSES, formatDate, formatDateTime, projectStatusLabel } from '../utils/format';

type TabKey = 'overview' | 'activities' | 'volunteers' | 'indicators' | 'files' | 'location';

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { canManage } = useAuth();
  const { notify, notifyError } = useToast();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
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
    usersApi.list(true).then(setUsers).catch(() => undefined);
    projectsApi.categories().then(setCategories).catch(() => undefined);
  }, []);

  async function changeStatus(status: ProjectStatus) {
    try {
      setProject(await projectsApi.updateStatus(id, status));
      notify('Status atualizado.');
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o status.');
    }
  }

  async function changeProgress(progress: number) {
    try {
      setProject(await projectsApi.updateProgress(id, progress));
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o progresso.');
    }
  }

  async function generateReport() {
    setGenerating(true);
    try {
      await reportsApi.generate({
        projectIds: [id],
        includeActivities: true,
        includeVolunteers: true,
        includeIndicators: true,
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
    { key: 'overview', label: 'Visão geral' },
    { key: 'activities', label: 'Atividades', count: project.activities.length },
    { key: 'volunteers', label: 'Voluntários', count: project.volunteers.length },
    { key: 'indicators', label: 'Indicadores', count: project.indicators.length },
    { key: 'files', label: 'Fotos e documentos', count: project.files.length },
    { key: 'location', label: 'Localização' }
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to="/projetos" className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          Projetos
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text">
          <h1>{project.name}</h1>
          <p className="page-head__desc">
            {project.category}
            {project.city ? ` · ${project.district ? `${project.district}, ` : ''}${project.city}` : ''}
            {project.ownerName ? ` · responsável: ${project.ownerName}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusBadge status={project.status} />
            {project.isLate ? <LateBadge /> : null}
            {project.isArchived ? <NeutralBadge>Arquivado</NeutralBadge> : null}
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

      <div className="panel section">
        <div className="panel__body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 220, flex: '1 1 260px' }}>
            <div className="meta__label">Progresso do projeto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={project.progress}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
                onChange={(event) => setProject({ ...project, progress: Number(event.target.value) })}
                onMouseUp={(event) => void changeProgress(Number((event.target as HTMLInputElement).value))}
                onTouchEnd={(event) => void changeProgress(Number((event.target as HTMLInputElement).value))}
                aria-label="Progresso do projeto"
              />
              <span className="num" style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>
                {project.progress}%
              </span>
            </div>
          </div>

          <div style={{ minWidth: 190 }}>
            <div className="meta__label">Status</div>
            <div style={{ marginTop: 6 }}>
              <Select
                value={project.status}
                aria-label="Status do projeto"
                onChange={(event) => void changeStatus(event.target.value as ProjectStatus)}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {projectStatusLabel(status)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="meta__label">Período</div>
            <div className="meta__value">
              {formatDate(project.startDate)} → {formatDate(project.endDateForecast)}
            </div>
          </div>

          <div>
            <div className="meta__label">Atividades concluídas</div>
            <div className="meta__value num">
              {project.activities.filter((activity) => activity.status === 'Concluida').length} de{' '}
              {project.activities.length}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.count !== undefined ? <span className="tab__count num">{item.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewTab project={project} /> : null}
      {tab === 'activities' ? <ActivitiesTab project={project} users={users} onChanged={() => void load()} /> : null}
      {tab === 'volunteers' ? <VolunteersTab project={project} onChanged={() => void load()} /> : null}
      {tab === 'indicators' ? (
        <IndicatorsTab project={project} canManage={canManage} onChanged={() => void load()} />
      ) : null}
      {tab === 'files' ? <FilesTab project={project} onChanged={() => void load()} /> : null}
      {tab === 'location' ? <LocationTab project={project} /> : null}

      {editing ? (
        <ProjectFormModal
          project={project}
          users={users}
          categories={categories}
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

function OverviewTab({ project }: { project: ProjectDetail }) {
  return (
    <div className="grid-sidebar">
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Sobre o projeto</h2>
          </div>
          <div className="panel__body">
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div className="meta__label">Descrição</div>
                <p className="meta__value">{project.description ?? 'Sem descrição registrada.'}</p>
              </div>
              <div>
                <div className="meta__label">Objetivo</div>
                <p className="meta__value">{project.objective ?? 'Sem objetivo registrado.'}</p>
              </div>
              {project.notes ? (
                <div>
                  <div className="meta__label">Observações</div>
                  <p className="meta__value">{project.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Indicadores do projeto</h2>
          </div>
          <div className="panel__body">
            {project.indicators.length === 0 ? (
              <EmptyState title="Sem indicadores" description="Registre indicadores na aba correspondente." />
            ) : (
              project.indicators.slice(0, 5).map((indicator) => (
                <div className="indicator" key={indicator.id}>
                  <div className="indicator__top">
                    <span className="indicator__name">{indicator.name}</span>
                    <span className="indicator__values num">
                      <strong>{indicator.value}</strong>
                      {indicator.unit ? ` ${indicator.unit}` : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Informações gerais</h2>
          </div>
          <div className="panel__body">
            <div className="meta-list">
              <div>
                <div className="meta__label">Responsável</div>
                <div className="meta__value">{project.ownerName ?? 'Não definido'}</div>
              </div>
              <div>
                <div className="meta__label">Comunidade ou beneficiários</div>
                <div className="meta__value">{project.beneficiaries ?? '—'}</div>
              </div>
              <div>
                <div className="meta__label">Público beneficiado</div>
                <div className="meta__value">{project.targetAudience ?? '—'}</div>
              </div>
              <div>
                <div className="meta__label">Localização</div>
                <div className="meta__value">
                  {[project.address, project.district, project.city, project.state].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <div>
                <div className="meta__label">Criado em</div>
                <div className="meta__value">{formatDateTime(project.createdAt)}</div>
              </div>
              <div>
                <div className="meta__label">Última atualização</div>
                <div className="meta__value">{formatDateTime(project.updatedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Resumo</h2>
          </div>
          <div className="panel__body">
            <div className="meta-list">
              <div>
                <div className="meta__label">Equipe vinculada</div>
                <div className="meta__value num">{project.volunteers.length} voluntário(s)</div>
              </div>
              <div>
                <div className="meta__label">Atividades</div>
                <div className="meta__value num">
                  {project.activities.filter((activity) => activity.status === 'Concluida').length} concluídas ·{' '}
                  {project.activities.filter((activity) => activity.status !== 'Concluida').length} pendentes
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
