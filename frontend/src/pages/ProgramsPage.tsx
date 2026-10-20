import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi } from '../api/endpoints';
import { ProgramFormModal } from '../components/programs/ProgramFormModal';
import { ProgramMark } from '../components/programs/ProgramMark';
import { NeutralBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconPlus } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program } from '../types/api';
import { projectsListPath } from '../utils/listState';

/** "3 em andamento · 9 concluídos" */
export function programProjectsSummary(program: Program) {
  const done = `${program.doneProjectsCount} concluído${program.doneProjectsCount === 1 ? '' : 's'}`;
  return `${program.activeProjectsCount} em andamento · ${done}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "5 atividades · 2 indicadores · textos sugeridos"; null quando o programa nao tem modelo. */
export function programTemplateSummary(program: Program) {
  const parts = [
    program.templateActivitiesCount > 0 ? plural(program.templateActivitiesCount, 'atividade', 'atividades') : null,
    program.templateIndicatorsCount > 0 ? plural(program.templateIndicatorsCount, 'indicador', 'indicadores') : null,
    program.hasTemplateTexts ? 'textos sugeridos' : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Programas (Projetos › Programas): um card por programa; o card leva a pagina do programa. */
export function ProgramsPage() {
  const { canManage } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPrograms(await programsApi.list(false));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os programas.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const archivedCount = programs?.filter((program) => program.status === 'Arquivado').length ?? 0;
  const visible = (programs ?? []).filter((program) => showArchived || program.status === 'Ativo');

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
          <h1>Programas</h1>
          <p className="page-head__desc">
            Programas agrupam projetos do mesmo tipo. Cada um pode ter um modelo com atividades e indicadores padrão.
          </p>
        </div>
        {canManage ? (
          <div className="page-head__actions">
            <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
              Novo programa
            </Button>
          </div>
        ) : null}
      </div>

      {archivedCount > 0 ? (
        <div className="toolbar">
          <label className="checkbox">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Mostrar arquivados ({archivedCount})
          </label>
        </div>
      ) : null}

      {error ? <Alert kind="error">{error}</Alert> : null}

      {programs === null && !error ? (
        <section className="panel">
          <Loading label="Carregando programas…" />
        </section>
      ) : visible.length === 0 && !error ? (
        <section className="panel">
          <EmptyState
            title="Nenhum programa cadastrado"
            description="Crie um programa para agrupar projetos do mesmo tipo, como banheiros ou hortas."
          />
        </section>
      ) : (
        <div className="program-grid">
          {visible.map((program) => (
            <Link key={program.id} to={`/programas/${program.id}`} className="program-card">
              <ProgramMark icon={program.icon} color={program.color} size={40} />
              <span className="program-card__body">
                <span className="program-card__name">
                  {program.name}
                  {program.status === 'Arquivado' ? <NeutralBadge>Arquivado</NeutralBadge> : null}
                </span>
                <span className="program-card__meta">{programProjectsSummary(program)}</span>
                <span className="program-card__meta">
                  {programTemplateSummary(program) ? `Modelo: ${programTemplateSummary(program)}` : 'Sem modelo'}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {creating ? (
        <ProgramFormModal
          program={null}
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            notify('Programa criado.');
            navigate(`/programas/${created.id}`);
          }}
        />
      ) : null}
    </>
  );
}
