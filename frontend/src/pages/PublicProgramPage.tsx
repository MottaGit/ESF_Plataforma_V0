import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, assetUrl } from '../api/client';
import { publicApi } from '../api/endpoints';
import { ProgramMark } from '../components/programs/ProgramMark';
import { Progress } from '../components/ui/Progress';
import type { ProjectStatus, PublicIndicator, PublicProgram, PublicProject } from '../types/api';
import { formatNumber, timeAgoPhrase } from '../utils/format';

/** Na pagina publica, "Planejamento" e dito para quem e de fora. */
const statusLabels: Record<ProjectStatus, string> = {
  EmAndamento: 'Em andamento',
  Pausado: 'Pausado',
  Planejamento: 'Em preparação',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado'
};

const statusClass: Record<ProjectStatus, string> = {
  Planejamento: 'badge--plan',
  EmAndamento: 'badge--run',
  Pausado: 'badge--pause',
  Concluido: 'badge--done',
  Cancelado: 'badge--cancel'
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-03-15" -> "mar/2026" (sem passar por Date, para o fuso nao mudar o dia). */
function monthYear(date: string) {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1]}/${year}`;
}

function isFuture(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(year, month - 1, day) > today;
}

function periodText(project: PublicProject) {
  const start = monthYear(project.startDate);
  if (project.status === 'Concluido')
    return project.closedOn ? `De ${start} a ${monthYear(project.closedOn)}` : `Início em ${start}`;
  const forecast = project.endDateForecast ? ` · previsão de término em ${monthYear(project.endDateForecast)}` : '';
  if (project.status === 'Planejamento' && isFuture(project.startDate)) return `Início previsto para ${start}${forecast}`;
  return `Desde ${start}${forecast}`;
}

function placeText(project: PublicProject) {
  const city = [project.city, project.state].filter(Boolean).join('/');
  return [project.district, city].filter(Boolean).join(', ');
}

function IndicatorValue({ indicator }: { indicator: PublicIndicator }) {
  return (
    <>
      <span className="num">{formatNumber(indicator.value)}</span>
      {indicator.unit ? ` ${indicator.unit}` : ''}
    </>
  );
}

/**
 * Pagina publica de um programa (/publico/{codigo}), sem login: para parceiros e financiadores acompanharem os
 * projetos. A coordenacao liga e desliga na visao do programa. So mostra o que a API libera.
 */
export function PublicProgramPage() {
  const { token = '' } = useParams();
  const [page, setPage] = useState<PublicProgram | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    publicApi
      .program(token)
      .then((data) => active && setPage(data))
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError && err.status !== 404
            ? err.message
            : 'Esta página não existe ou foi desligada pelo núcleo. Peça um link novo a quem enviou.'
        );
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Titulo da aba e fora dos buscadores: a pagina e para quem recebeu o link, nao para aparecer em pesquisas.
  useEffect(() => {
    const previousTitle = document.title;
    if (page) document.title = `${page.name} · ${page.nucleo.name}`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, [page]);

  if (error) {
    return (
      <div className="public-page">
        <main className="public-page__main">
          <div className="public-empty">
            <h1>Página indisponível</h1>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="public-page">
        <main className="public-page__main">
          <div className="public-empty" aria-busy="true">
            <span className="spinner spinner--lg" />
            <p>Carregando…</p>
          </div>
        </main>
      </div>
    );
  }

  const { nucleo, totals } = page;
  const counts = [
    { label: totals.concluded === 1 ? 'concluído' : 'concluídos', value: totals.concluded, show: true },
    { label: 'em andamento', value: totals.inProgress, show: true },
    { label: 'em preparação', value: totals.planning, show: totals.planning > 0 },
    { label: totals.paused === 1 ? 'pausado' : 'pausados', value: totals.paused, show: totals.paused > 0 }
  ].filter((count) => count.show);
  const nucleoPlace = [nucleo.city, nucleo.state].filter(Boolean).join('/');

  return (
    <div className="public-page">
      <header className="public-page__top">
        <div className="public-page__brand">
          {nucleo.logoUrl ? (
            <img src={assetUrl(nucleo.logoUrl)} alt="" className="public-page__logo" />
          ) : (
            <span className="sidebar__mark">ESF</span>
          )}
          <div>
            <strong>{nucleo.name}</strong>
            <span>Engenheiros Sem Fronteiras</span>
          </div>
        </div>
      </header>

      <main className="public-page__main">
        <section className="public-hero">
          <div className="public-hero__title">
            <ProgramMark icon={page.icon} color={page.color} size={52} />
            <div>
              <h1>{page.name}</h1>
              <p className="public-hero__meta">
                {page.projects.length === 1 ? '1 projeto' : `${page.projects.length} projetos`}
                {page.updatedAt ? ` · último registro ${timeAgoPhrase(page.updatedAt)}` : ''}
              </p>
            </div>
          </div>
          {page.about ? <p className="public-hero__about">{page.about}</p> : null}
        </section>

        <section className="public-section" aria-labelledby="public-results">
          <h2 id="public-results">Resultados até hoje</h2>
          <div className="public-stats">
            {counts.map((count) => (
              <div key={count.label} className="public-stat public-stat--count">
                <span className="public-stat__value num">{count.value}</span>
                <span className="public-stat__label">
                  {count.value === 1 ? 'projeto' : 'projetos'} {count.label}
                </span>
              </div>
            ))}
          </div>
          <div className="public-stats">
            {page.results.map((result) => (
              <div key={`${result.national}-${result.name}`} className="public-stat">
                <span className="public-stat__value">
                  <IndicatorValue indicator={result} />
                </span>
                <span className="public-stat__label">{result.name}</span>
              </div>
            ))}
            <div className="public-stat">
              <span className="public-stat__value num">{formatNumber(totals.volunteers)}</span>
              <span className="public-stat__label">
                {totals.volunteers === 1 ? 'voluntário participou' : 'voluntários participaram'}
              </span>
            </div>
            {totals.hours > 0 ? (
              <div className="public-stat">
                <span className="public-stat__value num">{formatNumber(totals.hours)}</span>
                <span className="public-stat__label">horas de voluntariado lançadas</span>
              </div>
            ) : null}
          </div>
          {page.results.length > 0 ? (
            <p className="public-note">Indicadores somados nos projetos, com os valores informados até hoje.</p>
          ) : null}
        </section>

        <section className="public-section" aria-labelledby="public-projects">
          <h2 id="public-projects">Projetos</h2>
          {page.projects.length === 0 ? (
            <p className="public-note">Ainda não há projetos para mostrar.</p>
          ) : (
            <div className="public-projects">
              {page.projects.map((project, index) => (
                <article key={`${project.name}-${index}`} className="public-project">
                  <div className="public-project__head">
                    <h3>{project.name}</h3>
                    <span className={`badge ${statusClass[project.status]}`}>
                      <span className="badge__dot" />
                      {statusLabels[project.status]}
                    </span>
                  </div>
                  {placeText(project) ? <p className="public-project__line">{placeText(project)}</p> : null}
                  <p className="public-project__line">{periodText(project)}</p>
                  {/* So para quem ja esta executando: "0% das tarefas" num projeto em preparacao parece abandono. */}
                  {project.status === 'EmAndamento' || project.status === 'Pausado' ? (
                    <div className="public-project__progress">
                      <Progress value={project.progress} />
                      <span>das tarefas concluídas</span>
                    </div>
                  ) : null}
                  {project.indicators.length > 0 ? (
                    <dl className="public-project__indicators">
                      {project.indicators.map((indicator) => (
                        <div key={indicator.name}>
                          <dt>{indicator.name}</dt>
                          <dd>
                            <IndicatorValue indicator={indicator} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {project.lastUpdateAt ? (
                    <p className="public-project__updated">Último registro {timeAgoPhrase(project.lastUpdateAt)}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="public-page__footer">
        <p>
          <strong>{nucleo.name}</strong>
          {nucleo.cnpj ? <span> · CNPJ {nucleo.cnpj}</span> : null}
          {nucleoPlace ? <span> · {nucleoPlace}</span> : null}
          {nucleo.email ? (
            <span>
              {' '}
              · <a href={`mailto:${nucleo.email}`}>{nucleo.email}</a>
            </span>
          ) : null}
        </p>
        <p className="public-page__footnote">
          Os dados vêm direto da plataforma de gestão de projetos do núcleo e se atualizam sozinhos.
        </p>
      </footer>
    </div>
  );
}
