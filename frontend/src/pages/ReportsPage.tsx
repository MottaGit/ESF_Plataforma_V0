import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi, projectsApi, reportsApi } from '../api/endpoints';
import { jobStatusText } from '../api/jobs';
import { RecentJobs } from '../components/jobs/RecentJobs';
import { ProgramPicker } from '../components/programs/ProgramPicker';
import {
  defaultReportOptions,
  ReportExtrasField,
  ReportNoteField,
  ReportPeriodField,
  reportOptionsError,
  reportPayload
} from '../components/reports/ReportOptions';
import { StatusBadge } from '../components/ui/Badge';
import { CollapsibleFilters } from '../components/ui/CollapsibleFilters';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, LoadError, Loading } from '../components/ui/Feedback';
import { IconAlert, IconDownload, IconSearch } from '../components/ui/Icons';
import { useToast } from '../context/ToastContext';
import type {
  BackgroundJob,
  Program,
  ProjectListItem,
  ProjectStatus,
  ReportFormat,
  ReportPeriodCount
} from '../types/api';
import { PROJECT_STATUSES, projectStatusLabel, todayInputValue } from '../utils/format';
import { defaultPeriod, legacyPeriod, periodName, periodShortcuts } from '../utils/periods';

/** Acima de quantos projetos marcados o formato sugerido (sem escolha na URL) e o Resumo. */
const SUMMARY_FROM = 10;

const FORMATS: Array<{ value: ReportFormat; slug: string; label: string; hint: string }> = [
  {
    value: 'Resumo',
    slug: 'resumo',
    label: 'Resumo',
    hint: 'Números somados por programa e uma tabela com os projetos. Poucas páginas.'
  },
  {
    value: 'Completo',
    slug: 'completo',
    label: 'Completo',
    hint: 'O resumo e mais um capítulo por projeto: indicadores, linha do tempo com fotos, tarefas e equipe.'
  }
];

/** Fora da lista por padrao: arquivados e cancelados (o botao "Incluir arquivados e cancelados" mostra). */
const isSetAside = (project: ProjectListItem) => project.isArchived || project.status === 'Cancelado';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Relatorios em tres passos: recorte (programa e periodo), formato e projetos. Programa, periodo, formato e filtros
 * ficam na URL; o periodo vai pelo nome do atalho (?periodo=trimestre: os ultimos 3 meses de quando o link for aberto)
 * ou pelas datas (?de=&ate=; sem ate, vai ate hoje). Os projetos marcados nao vao para a URL: ao abrir e ao trocar de programa, vem marcados os do recorte
 * (menos arquivados e cancelados).
 */
export function ReportsPage() {
  const { notify, notifyError } = useToast();
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

  const programId = searchParams.get('programa') ?? '';
  const debouncedSearch = searchParams.get('busca') ?? '';
  const status = (searchParams.get('status') ?? '') as ProjectStatus | '';
  const includeSetAside = searchParams.get('arquivados') === '1';

  // Periodo: pelo atalho (recalculado a cada dia), pelas datas do personalizado (sem "ate": ate hoje) ou, sem nada
  // na URL, o padrao (ultimos 12 meses). Links de antes do seletor (?periodo=trimestre-passado) viram as datas daquela
  // epoca.
  const shortcuts = useMemo(() => periodShortcuts(), []);
  const periodParam = searchParams.get('periodo');
  const shortcut = shortcuts.find((item) => item.key === periodParam) ?? null;
  const legacy = !shortcut && periodParam ? legacyPeriod(periodParam) : null;
  const customFrom = shortcut || legacy ? null : searchParams.get('de');
  const openEnded = Boolean(customFrom) && !searchParams.get('ate');
  const fallback = defaultPeriod();
  const from = shortcut?.from ?? legacy?.from ?? customFrom ?? fallback.from;
  const to = shortcut?.to ?? legacy?.to ?? (customFrom ? searchParams.get('ate') || todayInputValue() : fallback.to);
  const periodError = reportOptionsError({ from, to });

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [search, setSearch] = useState(debouncedSearch);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // "Só marcados" e "Sem autorização de imagem" mostram uma parte dos marcados, por cima dos filtros.
  const [view, setView] = useState<'all' | 'selected' | 'noImage'>('all');
  const [suggestedFormat, setSuggestedFormat] = useState<ReportFormat>('Completo');
  const [options, setOptions] = useState(defaultReportOptions);
  const [counts, setCounts] = useState<Map<string, ReportPeriodCount> | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Situacao do relatorio pedido (na fila, gerando) e recarga da lista de gerados.
  const [progress, setProgress] = useState<BackgroundJob | null>(null);
  const [recentKey, setRecentKey] = useState(0);
  const listRef = useRef<HTMLElement>(null);

  const formatSlug = searchParams.get('formato');
  const format = FORMATS.find((item) => item.slug === formatSlug)?.value ?? suggestedFormat;
  const photosIncluded = format === 'Completo' && options.includePhotos;

  useEffect(() => {
    const timer = window.setTimeout(() => updateParams({ busca: search.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [search, updateParams]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([projectsApi.list({ sort: 'name', includeArchived: true }), programsApi.list(false)])
      .then(([projectList, programList]) => {
        setProjects(projectList);
        setPrograms(programList);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os projetos.'))
      .finally(() => setLoading(false));
  }, [attempt]);

  // Recorte novo (ao abrir ou ao trocar de programa): marcados os projetos dele, menos arquivados e cancelados.
  useEffect(() => {
    const ids = projects
      .filter((project) => (!programId || project.programId === programId) && !isSetAside(project))
      .map((project) => project.id);
    setSelected(new Set(ids));
    setSuggestedFormat(ids.length > SUMMARY_FROM ? 'Resumo' : 'Completo');
    setView('all');
  }, [projects, programId]);

  // O que cada projeto tem no periodo (espera a pessoa terminar de digitar a data).
  useEffect(() => {
    if (periodError) return;
    let cancelled = false;
    setCounts(null);
    setCountsFailed(false);
    const timer = window.setTimeout(() => {
      reportsApi
        .periodCounts(from || null, to || null)
        .then((list) => {
          if (!cancelled) setCounts(new Map(list.map((item) => [item.projectId, item])));
        })
        .catch(() => {
          if (!cancelled) setCountsFailed(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [from, to, periodError, attempt]);

  const inScope = useMemo(
    () => projects.filter((project) => !programId || project.programId === programId),
    [projects, programId]
  );

  // Sem autorizacao de imagem so pesa quando o projeto tem foto que entra no PDF.
  const lacksImage = useCallback(
    (project: ProjectListItem) =>
      !project.imageAuthorizedOn && (counts ? (counts.get(project.id)?.photos ?? 0) > 0 : true),
    [counts]
  );

  const marked = inScope.filter((project) => selected.has(project.id));
  const noImage = photosIncluded ? marked.filter(lacksImage) : [];
  const idle = counts
    ? marked.filter((project) => {
        const count = counts.get(project.id);
        return !count || count.updates + count.tasks === 0;
      })
    : [];

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return inScope.filter((project) => {
      const matchesTerm =
        !term ||
        project.name.toLowerCase().includes(term) ||
        project.programName.toLowerCase().includes(term) ||
        (project.city ?? '').toLowerCase().includes(term);
      if (!matchesTerm) return false;
      if (view === 'selected') return selected.has(project.id);
      if (view === 'noImage') return selected.has(project.id) && lacksImage(project);
      if (!includeSetAside && isSetAside(project)) return false;
      return !status || project.status === status;
    });
  }, [inScope, debouncedSearch, view, selected, lacksImage, includeSetAside, status]);

  // Volta para a lista inteira quando a parte mostrada fica vazia (ex.: desmarcou o ultimo sem autorizacao).
  useEffect(() => {
    if (view === 'noImage' && noImage.length === 0) setView('all');
    if (view === 'selected' && selected.size === 0) setView('all');
  }, [view, noImage.length, selected.size]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Marca os que estao na lista, somando aos ja marcados. */
  function markVisible() {
    setSelected((current) => new Set([...current, ...visible.map((project) => project.id)]));
  }

  function unmarkIdle() {
    const ids = new Set(idle.map((project) => project.id));
    setSelected((current) => new Set([...current].filter((id) => !ids.has(id))));
  }

  function showPart(part: 'selected' | 'noImage') {
    setView((current) => (current === part ? 'all' : part));
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleGenerate() {
    if (marked.length === 0) return;
    setGenerating(true);
    try {
      // Montado em segundo plano: se a pessoa sair da tela, o download acontece do mesmo jeito.
      let started = false;
      const fileName = await reportsApi.generate(
        reportPayload(
          marked.map((project) => project.id),
          { ...options, from, to },
          format
        ),
        (job) => {
          setProgress(job);
          if (started) return;
          started = true;
          notify('Gerando o relatório. Pode sair desta tela: o download começa sozinho.');
        }
      );
      notify(`Relatório gerado: ${fileName}`);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível gerar o relatório.');
    } finally {
      setGenerating(false);
      setProgress(null);
      setRecentKey((current) => current + 1);
    }
  }

  function countsText(project: ProjectListItem) {
    if (countsFailed) return null;
    const count = counts?.get(project.id);
    if (!counts) return <span className="table__secondary">…</span>;
    if (!count || count.updates + count.tasks === 0)
      return <span className="table__secondary">Sem andamento no período</span>;
    const parts = [plural(count.updates, 'registro', 'registros')];
    if (photosIncluded && count.photos > 0) parts.push(plural(count.photos, 'foto', 'fotos'));
    if (count.tasks > 0) parts.push(plural(count.tasks, 'tarefa concluída', 'tarefas concluídas'));
    return parts.join(' · ');
  }

  const periodText = periodName(from, to, openEnded);

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Relatórios</h1>
          <p className="page-head__desc">PDF para parceiros e prestação de contas: escolha o recorte, o formato e os projetos.</p>
        </div>
      </div>

      {error ? <LoadError message={error} onRetry={() => setAttempt((current) => current + 1)} /> : null}

      <section className="panel report-setup">
        <div className="report-step">
          <h2 className="report-step__title">
            <span className="report-step__number">1</span> Recorte
          </h2>
          {programs.length > 1 ? (
            <div className="field">
              <span className="field__label">Programa</span>
              <ProgramPicker
                programs={programs}
                selectedId={programId}
                onSelect={(id) => updateParams({ programa: id })}
              />
            </div>
          ) : null}
          <ReportPeriodField
            from={from}
            to={to}
            openEnded={openEnded}
            onShortcut={(item) => updateParams({ periodo: item.key, de: null, ate: null })}
            onCustom={(nextFrom, nextTo) => updateParams({ periodo: null, de: nextFrom, ate: nextTo })}
          />
        </div>

        <div className="report-step">
          <h2 className="report-step__title">
            <span className="report-step__number">2</span> Formato
          </h2>
          <div className="report-formats" role="radiogroup" aria-label="Formato do relatório">
            {FORMATS.map((item) => (
              <label key={item.value} className="term-choice">
                <input
                  type="radio"
                  name="report-format"
                  checked={format === item.value}
                  onChange={() => updateParams({ formato: item.slug })}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </label>
            ))}
          </div>
          {format === 'Completo' ? <ReportExtrasField value={options} onChange={setOptions} /> : null}
          <ReportNoteField value={options} onChange={setOptions} />
        </div>
      </section>

      <section className="panel" ref={listRef}>
        <div className="panel__head">
          <h2 className="report-step__title">
            <span className="report-step__number">3</span> Projetos
            {!loading ? (
              <span className="report-step__count">
                {marked.length} de {inScope.length} {marked.length === 1 ? 'marcado' : 'marcados'}
              </span>
            ) : null}
          </h2>
          <div className="panel__actions">
            <Button small onClick={markVisible} disabled={visible.length === 0}>
              Marcar todos
            </Button>
            <Button small variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="panel__body report-list__filters">
          <div className="toolbar">
            <CollapsibleFilters active={[debouncedSearch, status, includeSetAside].filter(Boolean).length}>
              <span className="search">
                <IconSearch className="search__icon" />
                <TextInput
                  placeholder="Buscar projeto"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar projeto"
                />
              </span>
              <Select
                value={status}
                onChange={(event) => updateParams({ status: event.target.value || null })}
                aria-label="Filtrar por status"
                disabled={view !== 'all'}
              >
                <option value="">Todos os status</option>
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {projectStatusLabel(value)}
                  </option>
                ))}
              </Select>
              <div className="toolbar__chips" role="group" aria-label="Mais filtros">
                <button
                  type="button"
                  className={`chip${includeSetAside ? ' chip--active' : ''}`}
                  aria-pressed={includeSetAside}
                  disabled={view !== 'all'}
                  onClick={() => updateParams({ arquivados: includeSetAside ? null : '1' })}
                >
                  Incluir arquivados e cancelados
                </button>
              </div>
            </CollapsibleFilters>

            {/* Partes dos marcados: ficam a mostra tambem no celular. */}
            <div className="toolbar__right chip-group" role="group" aria-label="Ver os marcados">
              <button
                type="button"
                className={`chip${view === 'selected' ? ' chip--active' : ''}`}
                aria-pressed={view === 'selected'}
                disabled={selected.size === 0}
                onClick={() => showPart('selected')}
              >
                Só marcados <span className="chip__count">{marked.length}</span>
              </button>
              {noImage.length > 0 ? (
                <button
                  type="button"
                  className={`chip${view === 'noImage' ? ' chip--active' : ''}`}
                  aria-pressed={view === 'noImage'}
                  onClick={() => showPart('noImage')}
                >
                  Sem autorização de imagem <span className="chip__count">{noImage.length}</span>
                </button>
              ) : null}
            </div>
          </div>

          {noImage.length > 0 ? (
            <Alert kind="warning">
              {noImage.length === 1 ? '1 projeto marcado não tem' : `${noImage.length} projetos marcados não têm`}{' '}
              autorização de uso de imagem dos beneficiários registrada. As fotos entram no relatório; confira se podem
              ser usadas.{' '}
              {view !== 'noImage' ? (
                <button type="button" className="link-button" onClick={() => showPart('noImage')}>
                  Ver quais
                </button>
              ) : null}
            </Alert>
          ) : null}

          {idle.length > 0 ? (
            <p className="report-list__idle">
              {idle.length === 1 ? '1 projeto marcado está' : `${idle.length} projetos marcados estão`} sem andamento
              no período.{' '}
              <button type="button" className="link-button" onClick={unmarkIdle}>
                {idle.length === 1 ? 'Desmarcar' : `Desmarcar os ${idle.length}`}
              </button>
            </p>
          ) : null}
        </div>

        {loading ? (
          <Loading label="Carregando projetos…" />
        ) : error ? (
          <p className="field__hint" style={{ padding: 16 }}>
            A lista de projetos não carregou.
          </p>
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nenhum projeto encontrado"
            description={
              inScope.some(isSetAside) && !includeSetAside
                ? 'Ajuste a busca, o status ou inclua os arquivados e cancelados.'
                : 'Ajuste a busca ou o status.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards report-list">
              <thead>
                <tr>
                  <th style={{ width: 44 }} />
                  <th>Projeto</th>
                  <th>Status</th>
                  <th>No período</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((project) => (
                  <tr key={project.id} onClick={() => toggle(project.id)} style={{ cursor: 'pointer' }}>
                    <td className="cell--check">
                      <input
                        type="checkbox"
                        checked={selected.has(project.id)}
                        onChange={() => toggle(project.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Incluir ${project.name}`}
                        style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                      />
                    </td>
                    <td className="cell--main">
                      <div className="table__primary">{project.name}</div>
                      <div className="table__secondary">
                        {[project.programName, project.city, project.isArchived ? 'arquivado' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td className="report-list__status">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="cell--grow report-list__counts">
                      {countsText(project)}
                      {photosIncluded && lacksImage(project) ? (
                        <div className="report-list__warn">
                          <IconAlert size={13} /> Sem autorização de imagem
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {countsFailed ? (
          <p className="field__hint" style={{ padding: '10px 18px' }}>
            Não foi possível ver o que cada projeto tem no período; o PDF sai normalmente.
          </p>
        ) : null}
      </section>

      <RecentJobs kinds={['Report']} title="Gerados recentemente" fallbackName="Relatório" refreshKey={recentKey} />

      {/* Preso embaixo da tela: o que vai sair e o botao, sem precisar voltar ao topo da lista. */}
      <div className="report-bar" role="region" aria-label="Gerar o PDF">
        <div className="report-bar__text">
          <strong>{marked.length === 0 ? 'Nenhum projeto marcado' : plural(marked.length, 'projeto', 'projetos')}</strong>
          <span aria-live="polite">
            {progress ? jobStatusText(progress) : `${format} · ${periodText}`}
          </span>
        </div>
        <Button
          variant="primary"
          icon={<IconDownload size={15} />}
          loading={generating}
          disabled={marked.length === 0 || Boolean(periodError)}
          onClick={() => void handleGenerate()}
        >
          Gerar PDF
        </Button>
      </div>
    </>
  );
}
