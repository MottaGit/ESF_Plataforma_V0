import type { CSSProperties } from 'react';
import { programEmoji, programHex } from '../../utils/programs';

/** Icone do programa num circulo com a cor dele (cards, cabecalhos e listas). */
export function ProgramMark({ icon, color, size = 32 }: { icon: string; color: string; size?: number }) {
  const style = { '--program-color': programHex(color), width: size, height: size, fontSize: size * 0.5 } as CSSProperties;
  return (
    <span className="program-mark" style={style} aria-hidden="true">
      {programEmoji(icon)}
    </span>
  );
}
