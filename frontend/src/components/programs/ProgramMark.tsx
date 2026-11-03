import type { CSSProperties } from 'react';
import { programHex, programIconBody } from '../../utils/programs';

/** Desenho do icone de um programa, de traco, na cor do texto em volta. */
export function ProgramIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Desenhos fixos do proprio app (utils/programs.ts), nunca texto vindo de fora.
      dangerouslySetInnerHTML={{ __html: programIconBody(icon) }}
    />
  );
}

/** Icone do programa num circulo com a cor dele (listas, cabecalhos e o seletor de programas). */
export function ProgramMark({ icon, color, size = 32 }: { icon: string; color: string; size?: number }) {
  const style = { '--program-color': programHex(color), width: size, height: size } as CSSProperties;
  return (
    <span className="program-mark" style={style} aria-hidden="true">
      <ProgramIcon icon={icon} size={Math.round(size * 0.6)} />
    </span>
  );
}
