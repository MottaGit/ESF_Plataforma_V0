import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import type { Indicator, ProjectDetail } from '../../types/api';
import { formatNumber, timeAgoPhrase } from '../../utils/format';
import { Progress } from '../ui/Progress';
import { IndicatorFormModal, IndicatorValueModal } from './IndicatorModals';

interface ProjectStatusStripProps {
  project: ProjectDetail;
  /** Coordenacao ve o convite para cadastrar indicadores quando o projeto ainda nao tem nenhum. */
  canManage: boolean;
  onOpenTab: (tab: 'activities' | 'team' | 'about', filter?: 'atrasadas') => void;
  /** Indicador atualizado ou criado pela faixa. */
  onChanged: () => void;
}

/**
 * Faixa de situacao do projeto, logo abaixo do cabecalho e visivel em todas as abas:
 * progresso, atividades atrasadas, bloqueadas e equipe e, embaixo, os indicadores (resultados).
 * Cada bloco leva a aba correspondente; tocar num indicador atualiza o valor ali mesmo (nome e unidade, em Sobre).
 */
export function ProjectStatusStrip({ project, canManage, onOpenTab, onChanged }: ProjectStatusStripProps) {
  const { notify } = useToast();
  const [updating, setUpdating] = useState<Indicator | null>(null);
  const [creating, setCreating] = useState(false);

  const total = project.activities.length;
  const done = project.activities.filter((activity) => activity.status === 'Concluida').length;
  const pending = project.activities.filter((activity) => activity.status !== 'Concluida');

  const late = pending
    .filter((activity) => activity.isLate)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const blocked = pending.filter((activity) => activity.status === 'Bloqueada');
  const firstBlocked = blocked[0];

  // Responsavel pelo projeto primeiro, depois o restante da equipe.
  const team = [...project.volunteers].sort((a, b) =>
    a.volunteerId === project.ownerVolunteerId ? -1 : b.volunteerId === project.ownerVolunteerId ? 1 : 0
  );
  const teamNames = team.slice(0, 2).map((member) => member.name.split(' ')[0]);

  return (
    <div className="status-strip">
      <button type="button" className="status-tile" onClick={() => onOpenTab('activities')}>
        <span className="status-tile__label">Progresso</span>
        {total === 0 && project.status !== 'Concluido' ? (
          <span className="status-tile__value num">—</span>
        ) : (
          <Progress value={project.progress} />
        )}
        <span className="status-tile__hint num">
          {total === 0 ? 'Nenhuma tarefa cadastrada' : `${done} de ${total} tarefas concluídas`}
        </span>
      </button>

      <button
        type="button"
        className={`status-tile${late.length > 0 ? ' status-tile--alert' : ''}`}
        onClick={() => onOpenTab('activities', late.length > 0 ? 'atrasadas' : undefined)}
      >
        <span className="status-tile__label">Atrasadas</span>
        <span className="status-tile__value num">{late.length}</span>
        <span className="status-tile__hint">
          {late.length === 0
            ? 'Nenhuma tarefa atrasada'
            : `${late[0].title}${late.length > 1 ? ` e mais ${late.length - 1}` : ''}`}
        </span>
      </button>

      <button type="button" className="status-tile" onClick={() => onOpenTab('activities')}>
        <span className="status-tile__label">Bloqueadas</span>
        <span className="status-tile__value num">{blocked.length}</span>
        <span className="status-tile__hint">
          {!firstBlocked
            ? 'Nenhuma tarefa bloqueada'
            : `${firstBlocked.title}${firstBlocked.blockedReason ? `: ${firstBlocked.blockedReason}` : ''}${blocked.length > 1 ? ` e mais ${blocked.length - 1}` : ''}`}
        </span>
      </button>

      <button type="button" className="status-tile" onClick={() => onOpenTab('team')}>
        <span className="status-tile__label">Equipe</span>
        <span className="status-tile__value num">{team.length}</span>
        <span className="status-tile__hint">
          {team.length === 0
            ? 'Ninguém vinculado ainda'
            : `${teamNames.join(', ')}${team.length > teamNames.length ? ` e mais ${team.length - teamNames.length}` : ''}`}
        </span>
      </button>

      {project.indicators.length > 0 || canManage ? (
        <div className="status-results">
          {project.indicators.length === 0 ? (
            <button type="button" className="status-results__empty" onClick={() => setCreating(true)}>
              Nenhum indicador de resultado ainda. Cadastre o primeiro (ex.: famílias atendidas, área construída).
            </button>
          ) : (
            project.indicators.map((indicator) => (
              <button
                type="button"
                className="status-result"
                key={indicator.id}
                title="Atualizar o valor"
                onClick={() => setUpdating(indicator)}
              >
                <span className="status-tile__label">{indicator.name}</span>
                <span className="status-result__value num">
                  {indicator.value == null ? (
                    <span className="status-result__blank">não informado</span>
                  ) : (
                    <>
                      {formatNumber(indicator.value)}
                      {indicator.target != null ? <small> de {formatNumber(indicator.target)}</small> : null}
                      {indicator.unit ? <small> {indicator.unit}</small> : null}
                    </>
                  )}
                </span>
                {indicator.value != null && indicator.valueUpdatedAt ? (
                  <span className="status-result__when">atualizado {timeAgoPhrase(indicator.valueUpdatedAt)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}

      {updating ? (
        <IndicatorValueModal
          indicator={updating}
          onClose={() => setUpdating(null)}
          onSaved={() => {
            setUpdating(null);
            notify('Valor atualizado.');
            onChanged();
          }}
        />
      ) : null}

      {creating ? (
        <IndicatorFormModal
          projectId={project.id}
          indicator={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify('Indicador criado.');
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
