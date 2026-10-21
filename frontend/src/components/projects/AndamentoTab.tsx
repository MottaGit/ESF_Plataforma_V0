import type { ProjectDetail } from '../../types/api';
import { UpdatesSection } from './UpdatesSection';

interface AndamentoTabProps {
  project: ProjectDetail;
  onChanged: () => void;
  /** Veio de um "Registrar": o cursor ja vai para o campo de registro. */
  focusComposer?: boolean;
}

/**
 * Tela inicial do projeto: publicar e acompanhar o andamento. Fica numa coluna so, com largura de leitura;
 * a situacao do projeto (progresso, atrasadas, equipe) esta na faixa acima das abas.
 */
export function AndamentoTab({ project, onChanged, focusComposer }: AndamentoTabProps) {
  return (
    <div className="feed">
      <UpdatesSection project={project} onChanged={onChanged} focusComposer={focusComposer} />
    </div>
  );
}
