import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { projectsApi, reportsApi } from '../api/endpoints';
import {
  DEFAULT_REPORT_OPTIONS,
  ReportOptionsFields,
  reportOptionsError,
  reportPayload
} from '../components/reports/ReportOptions';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Field';
import { EmptyState, LoadError, Loading } from '../components/ui/Feedback';
import { IconDownload, IconSearch } from '../components/ui/Icons';
import { useToast } from '../context/ToastContext';
import type { ProjectListItem, ProjectStatus } from '../types/api';
import { PROJECT_STATUSES, formatDate, projectStatusLabel } from '../utils/format';

export function ReportsPage() {
  const { notify, notifyError } = useToast();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [selected, setSelected] = useState<string[]>([]);
  // Vindo da visao de um programa (?programa=): a lista abre filtrada nele, com os projetos dele ja marcados (menos
  // cancelados e arquivados).
  const [searchParams] = useSearchParams();
  const [programFilter, setProgramFilter] = useState(searchParams.get('programa') ?? '');
  const preselected = useRef(false);
  const optionsRef = useRef<HTMLElement>(null);

  const [options, setOptions] = useState(DEFAULT_REPORT_OPTIONS);
  const [generating, setGenerating] = useState(false);

  // "Tentar de novo" so muda esta chave e a lista e pedida outra vez.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError(null);
    projectsApi
      .list({ sort: 'name', includeArchived: true })
      .then((list) => {
        setProjects(list);
        const program = searchParams.get('programa');
        if (program && !preselected.current) {
          preselected.current = true;
          setSelected(
            list
              .filter((project) => project.programId === program && !project.isArchived && project.status !== 'Cancelado')
              .map((project) => project.id)
          );
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os projetos.'))
      .finally(() => setLoading(false));
  }, [attempt]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (programFilter && project.programId !== programFilter) return false;
      const matchesStatus = !status || project.status === status;
      const matchesTerm =
        !term ||
        project.name.toLowerCase().includes(term) ||
        project.programName.toLowerCase().includes(term) ||
        (project.city ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [projects, search, status, programFilter]);

  // Programas que aparecem nos projetos, para o filtro.
  const programs = useMemo(() => {
    const byId = new Map<string, string>();
    projects.forEach((project) => byId.set(project.programId, project.programName));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  // Selecionados sem autorizacao de uso de imagem dos beneficiarios: so um aviso, o PDF nao muda.
  const withoutImageAuthorization = projects.filter(
    (project) => selected.includes(project.id) && !project.imageAuthorizedOn
  );

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleGenerate() {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      const fileName = await reportsApi.generate(reportPayload(selected, options));
      notify(`Relatório gerado: ${fileName}`);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível gerar o relatório.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Relatórios</h1>
          <p className="page-head__desc">Escolha os projetos e gere o PDF para parceiros e prestação de contas.</p>
        </div>
      </div>

      {error ? <LoadError message={error} onRetry={() => setAttempt((current) => current + 1)} /> : null}

      <div className="grid-sidebar">
        <section className="panel">
          <div className="panel__head">
            <h2>Projetos no relatório</h2>
            <div className="panel__actions">
              <Button small onClick={() => setSelected(filtered.map((project) => project.id))}>
                Selecionar todos
              </Button>
              <Button small variant="ghost" onClick={() => setSelected([])}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="panel__body" style={{ paddingBottom: 0 }}>
            <div className="toolbar">
              <span className="search">
                <IconSearch className="search__icon" />
                <TextInput
                  placeholder="Buscar projeto"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar projeto"
                />
              </span>
              {programs.length > 1 ? (
                <Select
                  value={programFilter}
                  onChange={(event) => setProgramFilter(event.target.value)}
                  aria-label="Filtrar por programa"
                >
                  <option value="">Todos os programas</option>
                  {programs.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {projectStatusLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <Loading label="Carregando projetos…" />
          ) : error ? (
            <p className="field__hint" style={{ padding: 16 }}>
              A lista de projetos não carregou.
            </p>
          ) : filtered.length === 0 ? (
            <EmptyState title="Nenhum projeto encontrado" description="Ajuste a busca ou o filtro de status." />
          ) : (
            <div className="table-wrap">
              <table className="table table--cards">
                <thead>
                  <tr>
                    <th style={{ width: 44 }} />
                    <th>Projeto</th>
                    <th>Status</th>
                    <th className="tight">Período</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project) => (
                    <tr key={project.id} onClick={() => toggle(project.id)} style={{ cursor: 'pointer' }}>
                      <td className="cell--check">
                        <input
                          type="checkbox"
                          checked={selected.includes(project.id)}
                          onChange={() => toggle(project.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Incluir ${project.name}`}
                          style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                        />
                      </td>
                      <td className="cell--main">
                        <div className="table__primary">{project.name}</div>
                        <div className="table__secondary">
                          {project.programName}
                          {project.isArchived ? ' · arquivado' : ''}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="tight">
                        {formatDate(project.startDate)}
                        <div className="table__secondary">até {formatDate(project.endDateForecast)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" style={{ alignSelf: 'start' }} ref={optionsRef}>
          <div className="panel__head">
            <h2>Conteúdo do PDF</h2>
          </div>
          <div className="panel__body">
            <ReportOptionsFields
              value={options}
              onChange={setOptions}
              withoutImageAuthorization={withoutImageAuthorization.map((project) => project.name)}
            />

            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                block
                icon={<IconDownload size={15} />}
                loading={generating}
                disabled={selected.length === 0 || Boolean(reportOptionsError(options))}
                onClick={() => void handleGenerate()}
              >
                Gerar PDF ({selected.length})
              </Button>
              {selected.length === 0 ? (
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Marque ao menos um projeto na lista.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* No celular as opcoes ficam depois da lista inteira: o botao fica preso embaixo enquanto ha projetos marcados. */}
      {selected.length > 0 ? (
        <div className="report-mobile-bar" role="region" aria-label="Gerar o PDF">
          <button
            type="button"
            className="link-button"
            onClick={() => optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Período e opções
          </button>
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            loading={generating}
            disabled={Boolean(reportOptionsError(options))}
            onClick={() => void handleGenerate()}
          >
            Gerar PDF ({selected.length})
          </Button>
        </div>
      ) : null}
    </>
  );
}
