import { useEffect, useState } from 'react';
import { nationalIndicatorsApi } from '../../api/endpoints';
import type { NationalIndicator } from '../../types/api';
import { Field, Select } from '../ui/Field';

/** Indicadores nacionais ativos (para o modelo de programa e para mostrar o "como contar" nos projetos). */
export function useNationalIndicators() {
  const [list, setList] = useState<NationalIndicator[]>([]);
  useEffect(() => {
    nationalIndicatorsApi
      .list()
      .then(setList)
      .catch(() => undefined);
  }, []);
  return list;
}

interface NationalIndicatorFieldProps {
  id: string;
  /** Id do nacional escolhido; vazio: indicador especifico (nome e unidade proprios). */
  value: string;
  onChange: (id: string) => void;
  options: NationalIndicator[];
  /** O que nao for nacional e "especifico deste projeto" ou "deste programa". */
  scope: 'projeto' | 'programa';
  /** Indicador ja ligado a um nacional que saiu da lista (arquivado): continua aparecendo como opcao. */
  linked?: { id: string; name: string } | null;
}

/**
 * Escolha do indicador: um nacional da gestao nacional (nome, unidade e como contar vem dele, e o numero entra na
 * soma do painel nacional) ou um especifico, com nome e unidade proprios. Sem nenhum nacional cadastrado, nao aparece.
 */
export function NationalIndicatorField({ id, value, onChange, options, scope, linked }: NationalIndicatorFieldProps) {
  const chosen = options.find((option) => option.id === value);
  const archivedLink = linked && !options.some((option) => option.id === linked.id) ? linked : null;
  if (options.length === 0 && !archivedLink) return null;

  const hint = chosen
    ? chosen.description
      ? `Como contar: ${chosen.description}`
      : 'Nome e unidade vêm da gestão nacional.'
    : value
      ? 'Indicador nacional arquivado: continua valendo para este registro.'
      : scope === 'programa'
        ? 'Os nacionais já entram em todo projeto; escolher um aqui faz ele ser somado na visão do programa.'
        : 'Prefira um indicador nacional quando houver: o número entra na soma de todos os núcleos.';

  return (
    <Field label="Indicador" htmlFor={id} hint={hint} span>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Específico deste {scope}</option>
        <optgroup label="Indicadores nacionais">
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.unit ? ` (${option.unit})` : ''}
            </option>
          ))}
          {archivedLink ? <option value={archivedLink.id}>{archivedLink.name} (arquivado)</option> : null}
        </optgroup>
      </Select>
    </Field>
  );
}
