import type { Program } from '../types/api';

/**
 * Icones e cores dos programas. As chaves sao as mesmas da API (Common/ProgramAppearance.cs); uma chave
 * desconhecida cai no padrao.
 */
export const PROGRAM_ICONS: Array<{ key: string; emoji: string; label: string }> = [
  { key: 'banheiro', emoji: '🚽', label: 'Banheiro' },
  { key: 'horta', emoji: '🌱', label: 'Horta' },
  { key: 'evento', emoji: '🎪', label: 'Evento' },
  { key: 'casa', emoji: '🏠', label: 'Moradia' },
  { key: 'agua', emoji: '💧', label: 'Água' },
  { key: 'energia', emoji: '⚡', label: 'Energia' },
  { key: 'obra', emoji: '🔨', label: 'Obra' },
  { key: 'educacao', emoji: '📚', label: 'Educação' },
  { key: 'arvore', emoji: '🌳', label: 'Meio ambiente' },
  { key: 'reciclagem', emoji: '♻️', label: 'Reciclagem' },
  { key: 'comunidade', emoji: '🤝', label: 'Comunidade' },
  { key: 'pin', emoji: '📍', label: 'Local' }
];

export const PROGRAM_COLORS: Array<{ key: string; hex: string; label: string }> = [
  { key: 'teal', hex: '#0f766e', label: 'Verde-azulado' },
  { key: 'blue', hex: '#2563eb', label: 'Azul' },
  { key: 'green', hex: '#16a34a', label: 'Verde' },
  { key: 'orange', hex: '#ea580c', label: 'Laranja' },
  { key: 'red', hex: '#dc2626', label: 'Vermelho' },
  { key: 'purple', hex: '#7c3aed', label: 'Roxo' },
  { key: 'pink', hex: '#db2777', label: 'Rosa' },
  { key: 'gray', hex: '#64748b', label: 'Cinza' }
];

export const DEFAULT_PROGRAM_ICON = 'pin';
export const DEFAULT_PROGRAM_COLOR = 'teal';

export function programEmoji(icon: string | null | undefined) {
  return (PROGRAM_ICONS.find((item) => item.key === icon) ?? PROGRAM_ICONS[PROGRAM_ICONS.length - 1]).emoji;
}

export function programHex(color: string | null | undefined) {
  return (PROGRAM_COLORS.find((item) => item.key === color) ?? PROGRAM_COLORS[0]).hex;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "3 em andamento · 9 concluídos" */
export function programProjectsSummary(program: Program) {
  return `${program.activeProjectsCount} em andamento · ${plural(program.doneProjectsCount, 'concluído', 'concluídos')}`;
}

/** "5 tarefas · 2 indicadores · textos sugeridos"; null quando o programa nao tem modelo. */
export function programTemplateSummary(program: Program) {
  const parts = [
    program.templateActivitiesCount > 0 ? plural(program.templateActivitiesCount, 'tarefa', 'tarefas') : null,
    program.templateIndicatorsCount > 0 ? plural(program.templateIndicatorsCount, 'indicador', 'indicadores') : null,
    program.hasTemplateTexts ? 'textos sugeridos' : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
