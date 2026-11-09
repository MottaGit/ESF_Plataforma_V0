import { useState, type CSSProperties } from 'react';
import { PROGRAM_COLORS, PROGRAM_ICONS, programHex, programIconLabel } from '../../utils/programs';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { ProgramIcon, ProgramMark } from './ProgramMark';

interface ProgramLookFieldProps {
  icon: string;
  color: string;
  /** Explica de onde veio o icone (ex.: "Escolhido pelo nome do programa."). */
  hint: string;
  onIcon: (key: string) => void;
  onColor: (key: string) => void;
}

/**
 * Icone e cor do programa: o escolhido a mostra e, em "Trocar", a grade com todos os icones e as cores. Usado no
 * programa novo e em Editar programa › Sobre.
 */
export function ProgramLookField({ icon, color, hint, onIcon, onColor }: ProgramLookFieldProps) {
  const [picking, setPicking] = useState(false);
  const accent = { '--program-color': programHex(color) } as CSSProperties;

  return (
    <Field label="Ícone e cor">
      <div className="program-look">
        <ProgramMark icon={icon} color={color} size={40} />
        <div className="program-look__text">
          <strong>{programIconLabel(icon)}</strong>
          <span className="field__hint">{hint}</span>
        </div>
        <Button small aria-expanded={picking} onClick={() => setPicking((current) => !current)}>
          {picking ? 'Pronto' : 'Trocar'}
        </Button>
      </div>

      {picking ? (
        <div className="program-look__choices">
          <div className="icon-picker" role="radiogroup" aria-label="Ícone" style={accent}>
            {PROGRAM_ICONS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={icon === item.key}
                aria-label={item.label}
                title={item.label}
                className={`icon-picker__option${icon === item.key ? ' icon-picker__option--active' : ''}`}
                onClick={() => onIcon(item.key)}
              >
                <ProgramIcon icon={item.key} size={20} />
              </button>
            ))}
          </div>
          <div className="color-picker" role="radiogroup" aria-label="Cor">
            {PROGRAM_COLORS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={color === item.key}
                aria-label={item.label}
                title={item.label}
                className={`color-picker__option${color === item.key ? ' color-picker__option--active' : ''}`}
                style={{ background: item.hex }}
                onClick={() => onColor(item.key)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Field>
  );
}
