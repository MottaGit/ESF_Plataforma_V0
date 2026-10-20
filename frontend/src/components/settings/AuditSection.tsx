import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { auditApi, projectsApi, usersApi } from '../../api/endpoints';
import type { AuditEntry, AuditFilters, ProjectListItem, User } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { Select, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/Feedback';

/** Tipos de registro do historico, como a API grava. */
const ENTITY_TYPES = [
  'Projeto',
  'Atividade',
  'Relato',
  'Arquivo',
  'Indicador',
  'Equipe',
  'Voluntário',
  'Documento assinado',
  'Programa',
  'Usuário',
  'Organização'
];

/** "alterou a atividade", "criou o projeto"... (Equipe tem frase propria). */
function describe(entry: AuditEntry) {
  if (entry.entityType === 'Equipe') {
    if (entry.action === 'Created') return `adicionou ${entry.entityLabel} à equipe`;
    if (entry.action === 'Deleted') return `tirou ${entry.entityLabel} da equipe`;
    return `alterou a função de ${entry.entityLabel} na equipe`;
  }
  const verb = entry.action === 'Created' ? 'criou' : entry.action === 'Deleted' ? 'excluiu' : 'alterou';
  const feminine = ['Atividade', 'Organização'].includes(entry.entityType);
  if (entry.entityType === 'Organização') return `${verb} os dados da organização`;
  return `${verb} ${feminine ? 'a' : 'o'} ${entry.entityType.toLowerCase()} "${entry.entityLabel}"`;
}

/** Historico de alteracoes: quem mudou o que e quando (so administradores). */
export function AuditSection() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    projectsApi.list({ includeArchived: true, sort: 'name' }).then(setProjects).catch(() => undefined);
    usersApi.list().then(setUsers).catch(() => undefined);
  }, []);

  const load = useCallback(async (nextPage: number, current: AuditFilters) => {
    try {
      const result = await auditApi.list({ ...current, page: nextPage });
      setEntries((previous) => (nextPage === 1 ? result.items : [...(previous ?? []), ...result.items]));
      setHasMore(result.hasMore);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.');
    }
  }, []);

  useEffect(() => {
    setEntries(null);
    void load(1, filters);
  }, [filters, load]);

  function update(changes: Partial<AuditFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  async function loadMore() {
    setLoadingMore(true);
    await load(page + 1, filters);
    setLoadingMore(false);
  }

  return (
    <>
      <div className="toolbar">
        <Select
          aria-label="Projeto"
          value={filters.projectId ?? ''}
          onChange={(event) => update({ projectId: event.target.value || undefined })}
          className="audit__filter"
        >
          <option value="">Todos os projetos</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Pessoa"
          value={filters.userId ?? ''}
          onChange={(event) => update({ userId: event.target.value || undefined })}
        >
          <option value="">Todas as pessoas</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.volunteerName ?? user.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Tipo"
          value={filters.entityType ?? ''}
          onChange={(event) => update({ entityType: event.target.value || undefined })}
        >
          <option value="">Todos os tipos</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <TextInput
          type="date"
          aria-label="De"
          title="De"
          value={filters.from ?? ''}
          onChange={(event) => update({ from: event.target.value || undefined })}
          className="audit__date"
        />
        <TextInput
          type="date"
          aria-label="Até"
          title="Até"
          value={filters.to ?? ''}
          onChange={(event) => update({ to: event.target.value || undefined })}
          className="audit__date"
        />
      </div>

      <p className="field__hint" style={{ marginBottom: 12 }}>
        Registro automático de quem criou, alterou ou excluiu algo na plataforma. Dados pessoais de voluntários não têm o
        valor guardado, só o fato de terem mudado.
      </p>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {entries === null ? (
          <Loading label="Carregando histórico…" />
        ) : entries.length === 0 ? (
          <EmptyState title="Nenhuma alteração encontrada" description="Ajuste os filtros ou o período." />
        ) : (
          <ul className="audit__list">
            {entries.map((entry) => (
              <li key={entry.id} className="audit__item">
                <div className="audit__head">
                  <span className="audit__what">
                    <strong>{entry.userName}</strong> {describe(entry)}
                  </span>
                  <span className="audit__when">{formatDateTime(entry.at)}</span>
                </div>
                {entry.projectId && entry.projectName && entry.entityType !== 'Projeto' ? (
                  <Link className="audit__project" to={`/projetos/${entry.projectId}`}>
                    {entry.projectName}
                  </Link>
                ) : null}
                {entry.changes.length > 0 ? (
                  <ul className="audit__changes">
                    {entry.changes.map((change, index) => (
                      <li key={index}>
                        <span className="audit__field">{change.field}:</span>{' '}
                        {/* Dado pessoal do voluntario: so o fato de ter mudado fica registrado. */}
                        {change.before === change.after
                          ? 'alterado (valor não guardado)'
                          : `${change.before} → ${change.after}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasMore ? (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Button loading={loadingMore} onClick={() => void loadMore()}>
            Carregar mais
          </Button>
        </div>
      ) : null}
    </>
  );
}
