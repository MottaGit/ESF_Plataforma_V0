import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { projectsApi, reportsApi } from '../api/endpoints';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../components/ui/Field';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
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

  const [includePhotos, setIncludePhotos] = useState(true);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    projectsApi
      .list({ sort: 'name', includeArchived: true })
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os projetos.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesStatus = !status || project.status === status;
      const matchesTerm =
        !term ||
        project.name.toLowerCase().includes(term) ||
        project.category.toLowerCase().includes(term) ||
        (project.city ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [projects, search, status]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function handleGenerate() {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      const fileName = await reportsApi.generate({
        projectIds: selected,
        includeActivities: true,
        includeVolunteers: true,
        includeIndicators: true,
        includeUpdates: true,
        includePhotos,
        note: note.trim() || null
      });
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
          <p className="page-head__desc">
            Selecione os projetos e gere um PDF consolidado para parceiros, registro de resultados ou prestação de contas.
          </p>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

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
          ) : filtered.length === 0 ? (
            <EmptyState title="Nenhum projeto encontrado" description="Ajuste a busca ou o filtro de status." />
          ) : (
            <div className="table-wrap">
              <table className="table">
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
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(project.id)}
                          onChange={() => toggle(project.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Incluir ${project.name}`}
                          style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                        />
                      </td>
                      <td>
                        <div className="table__primary">{project.name}</div>
                        <div className="table__secondary">
                          {project.category}
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

        <section className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel__head">
            <h2>Conteúdo do PDF</h2>
          </div>
          <div className="panel__body">
            <p className="field__hint" style={{ marginBottom: 10 }}>
              Indicadores, atividades, voluntários e atualizações sempre entram no PDF. Só as fotos são opcionais.
            </p>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <label className="checkbox">
                <input type="checkbox" checked={includePhotos} onChange={(event) => setIncludePhotos(event.target.checked)} />
                Registro fotográfico
              </label>
            </div>

            <Field
              label="Observação do relatório"
              htmlFor="report-note"
              hint="Aparece no início do documento. Ex.: finalidade, parceiro ou período de referência."
            >
              <TextArea id="report-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>

            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                block
                icon={<IconDownload size={15} />}
                loading={generating}
                disabled={selected.length === 0}
                onClick={() => void handleGenerate()}
              >
                Gerar PDF ({selected.length})
              </Button>
              {selected.length === 0 ? (
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Selecione ao menos um projeto na lista ao lado.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
