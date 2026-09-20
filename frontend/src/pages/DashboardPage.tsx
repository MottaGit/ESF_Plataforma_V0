import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { dashboardApi } from '../api/endpoints';
import { LateBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { IconPlus } from '../components/ui/Icons';
import { Progress } from '../components/ui/Progress';
import { useAuth } from '../context/AuthContext';
import type { Dashboard } from '../types/api';
import { dueLabel, formatDate, formatNumber, projectStatusLabel } from '../utils/format';

export function DashboardPage() {
  const { canManage, user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.get());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Carregando o resumo da organização…" />;

  if (error) {
    return (
      <Alert kind="error">
        {error} <button className="btn btn--sm" style={{ marginLeft: 10 }} onClick={() => void load()}>Tentar de novo</button>
      </Alert>
    );
  }

  if (!data) return null;

  const { totals, byStatus, topIndicators, activeProjects, upcomingActivities } = data;
  const firstName = (user?.name ?? '').split(' ')[0];

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Olá, {firstName}</h1>
          <p className="page-head__desc">Como estão os projetos da organização hoje.</p>
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
        <div className="stat">
          <div className="stat__value num">{totals.projects}</div>
          <div className="stat__label">Projetos ativos</div>
          <div className="stat__hint">Não arquivados</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{totals.inProgress}</div>
          <div className="stat__label">Em andamento</div>
          <div className="stat__hint">{totals.planning} em planejamento</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{totals.completed}</div>
          <div className="stat__label">Concluídos</div>
          <div className="stat__hint">Resultados já entregues</div>
        </div>
        <div className={`stat${totals.late > 0 ? ' stat--alert' : ''}`}>
          <div className="stat__value num">{totals.late}</div>
          <div className="stat__label">Atrasados</div>
          <div className="stat__hint">Previsão de término vencida</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{totals.pendingActivities}</div>
          <div className="stat__label">Atividades pendentes</div>
          <div className="stat__hint">A fazer ou em andamento</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{totals.volunteers}</div>
          <div className="stat__label">Voluntários envolvidos</div>
          <div className="stat__hint">Vinculados a algum projeto</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{totals.planning}</div>
          <div className="stat__label">Em planejamento</div>
          <div className="stat__hint">Ainda não iniciados</div>
        </div>
        <div className="stat">
          <div className="stat__value num">{byStatus.find((item) => item.status === 'Pausado')?.count ?? 0}</div>
          <div className="stat__label">Pausados</div>
          <div className="stat__hint">Aguardando retomada</div>
        </div>
      </div>

      <div className="grid-sidebar">
        <section className="panel">
          <div className="panel__head">
            <h2>Projetos em andamento</h2>
            <div className="panel__actions">
              <Link className="btn btn--sm" to="/projetos">
                Ver todos
              </Link>
            </div>
          </div>

          {activeProjects.length === 0 ? (
            <EmptyState
              title="Nenhum projeto ativo"
              description="Cadastre o primeiro projeto para começar a acompanhar o trabalho do núcleo."
              action={
                canManage ? (
                  <Button variant="primary" onClick={() => navigate('/projetos?novo=1')}>
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
                    <th>Progresso</th>
                    <th className="tight">Previsão</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link className="row-link" to={`/projetos/${project.id}`}>
                          {project.name}
                        </Link>
                        <div className="table__secondary">
                          {project.category}
                          {project.ownerName ? ` · ${project.ownerName}` : ''}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <Progress value={project.progress} />
                      </td>
                      <td className="tight">
                        {formatDate(project.endDateForecast)}
                        {project.isLate ? (
                          <div style={{ marginTop: 4 }}>
                            <LateBadge />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel__head">
              <h2>Indicadores consolidados</h2>
            </div>
            <div className="panel__body">
              {topIndicators.length === 0 ? (
                <EmptyState
                  title="Sem indicadores registrados"
                  description="Os indicadores de cada projeto aparecem aqui somados por nome."
                />
              ) : (
                topIndicators.map((indicator) => (
                  <div className="indicator" key={`${indicator.name}-${indicator.unit ?? ''}`}>
                    <div className="indicator__top">
                      <span className="indicator__name">{indicator.name}</span>
                      <span className="indicator__values num">
                        <strong>{formatNumber(indicator.value)}</strong>
                        {indicator.unit ? ` ${indicator.unit}` : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Próximas atividades</h2>
            </div>
            <div className="panel__body">
              {upcomingActivities.length === 0 ? (
                <EmptyState title="Nada pendente" description="Todas as atividades registradas estão concluídas." />
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {upcomingActivities.map((activity) => (
                    <div key={activity.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{activity.title}</div>
                        <div className="table__secondary">
                          <Link to={`/projetos/${activity.projectId}`}>{activity.projectName}</Link>
                          {activity.assignedUserName ? ` · ${activity.assignedUserName}` : ''}
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

          <section className="panel">
            <div className="panel__head">
              <h2>Distribuição por status</h2>
            </div>
            <div className="panel__body">
              {byStatus.length === 0 ? (
                <EmptyState title="Sem projetos cadastrados" />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {byStatus.map((item) => (
                    <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13 }}>{projectStatusLabel(item.status)}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
                        <Progress
                          value={totals.projects === 0 ? 0 : (item.count / totals.projects) * 100}
                          showValue={false}
                        />
                        <span className="num" style={{ fontSize: 13, width: 18, textAlign: 'right' }}>
                          {item.count}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
