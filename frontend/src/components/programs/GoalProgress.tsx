import { formatNumber } from '../../utils/format';

interface GoalProgressProps {
  /** Soma dos projetos do programa (null: nenhum informou ainda). */
  value: number | null;
  /** Meta do programa (do modelo de projeto). */
  target: number;
}

/**
 * Meta do programa: barra e "de 55 · 22%", embaixo do numero somado (visao do programa e pagina publica). Acima de
 * 100% a barra fica cheia e o percentual continua contando.
 */
export function GoalProgress({ value, target }: GoalProgressProps) {
  const reached = value ?? 0;
  const percent = target > 0 ? Math.round((reached / target) * 100) : 0;

  return (
    <span className="goal" title={`${formatNumber(reached)} de ${formatNumber(target)} (meta do programa)`}>
      <span className="goal__track" aria-hidden="true">
        <span className="goal__fill" style={{ width: `${Math.min(percent, 100)}%` }} />
      </span>
      <span className="goal__text">
        de {formatNumber(target)} · {percent}%
      </span>
    </span>
  );
}
