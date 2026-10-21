import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi } from '../api/endpoints';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ProgramTemplateTab } from '../components/programs/ProgramTemplateTab';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconChevronLeft } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import type { Program } from '../types/api';

/** Endereco antigo da pagina do programa: hoje o programa e uma aba da tela Projetos. */
export function ProgramRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/projetos?programa=${id}`} replace />;
}

/** Modelo do programa (Projetos › programa › Modelo do programa): tarefas, indicadores e textos padrao. */
export function ProgramTemplatePage() {
  const { id = '' } = useParams();
  const { canManage } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    programsApi
      .get(id)
      .then(setProgram)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o programa.'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!program) return <Loading label="Carregando modelo…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to={`/projetos?programa=${program.id}`} className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          {program.name}
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text person-head">
          <ProgramMark icon={program.icon} color={program.color} size={48} />
          <div>
            <h1>Modelo do programa</h1>
            <p className="page-head__desc">{program.name}</p>
          </div>
        </div>
      </div>

      <ProgramTemplateTab programId={program.id} canEdit={canManage} onChanged={load} />
    </>
  );
}
