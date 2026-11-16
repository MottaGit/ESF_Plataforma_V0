import type { ProjectUpdateKind } from '../../types/api';
import { UPDATE_KINDS, updateKindLabel } from '../../utils/format';

interface UpdateKindPickerProps {
  value: ProjectUpdateKind | null;
  onChange: (kind: ProjectUpdateKind | null) => void;
}

/**
 * Tipo do registro de andamento (opcional), num toque: tocar de novo no escolhido tira o tipo. Com fotos, o registro
 * com tipo vira a pasta "AAAA-MM-DD – Tipo" no Google Drive; sem tipo, as fotos vao para "Outras fotos".
 */
export function UpdateKindPicker({ value, onChange }: UpdateKindPickerProps) {
  return (
    <div className="update-kinds" role="group" aria-label="Tipo do registro">
      <span className="update-kinds__label">Tipo</span>
      {UPDATE_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          className={`chip${value === kind ? ' chip--active' : ''}`}
          aria-pressed={value === kind}
          onClick={() => onChange(value === kind ? null : kind)}
        >
          {updateKindLabel(kind)}
        </button>
      ))}
      <span className="field__hint">opcional</span>
    </div>
  );
}
