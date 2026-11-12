import { formatDate } from './format';

/** Data local no formato do campo de data (aaaa-mm-dd). */
export function inputDate(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

export interface PeriodShortcut {
  /** Nome na URL (?periodo=): o link guarda "trimestre", e as datas acompanham o dia em que ele e aberto. */
  key: string;
  /** No botao e no menu ("Trimestre"). */
  label: string;
  /** Explicacao no menu ("últimos 3 meses"). */
  hint: string;
  /** aaaa-mm-dd */
  from: string;
  to: string;
}

/**
 * Atalhos de periodo (relatorios e painel nacional): os ultimos dias ou meses ate hoje, pelo calendario de quem esta
 * usando. O mesmo dia N meses atras ("Trimestre" em 12/11 comeca em 12/08).
 */
export function periodShortcuts(today = new Date()): PeriodShortcut[] {
  const back = (months: number, days = 0) =>
    inputDate(new Date(today.getFullYear(), today.getMonth() - months, today.getDate() - days));
  const end = inputDate(today);
  return [
    { key: '30-dias', label: '30 dias', hint: 'últimos 30 dias', from: back(0, 30), to: end },
    { key: 'trimestre', label: 'Trimestre', hint: 'últimos 3 meses', from: back(3), to: end },
    { key: 'semestre', label: 'Semestre', hint: 'últimos 6 meses', from: back(6), to: end },
    { key: 'ano', label: 'Ano', hint: 'últimos 12 meses', from: back(12), to: end }
  ];
}

/** Periodo de quem ainda nao escolheu outro: o ultimo ano. */
export const DEFAULT_PERIOD_KEY = 'ano';

export function defaultPeriod(today = new Date()) {
  return periodShortcuts(today).find((shortcut) => shortcut.key === DEFAULT_PERIOD_KEY)!;
}

/**
 * Nome do periodo para mostrar: o do atalho com exatamente estas datas ("Trimestre") ou as datas ("11/04/2026 –
 * 12/11/2026"). openEnded: personalizado "sem data final", sempre pelas datas.
 */
export function periodName(from: string, to: string, openEnded = false) {
  const shortcut = openEnded ? null : periodShortcuts().find((item) => item.from === from && item.to === to);
  return shortcut ? shortcut.label : `${formatDate(from)} – ${formatDate(to)}`;
}

/**
 * Links de antes do seletor de periodo (?periodo=trimestre-passado): as mesmas datas daquela epoca, como periodo
 * personalizado. null para nome desconhecido (e para "tudo", que saiu): vale o periodo padrao.
 */
export function legacyPeriod(key: string, today = new Date()): { from: string; to: string } | null {
  const year = today.getFullYear();
  const month = today.getMonth();
  const quarter = Math.floor(month / 3);
  switch (key) {
    case 'mes-passado':
      return { from: inputDate(new Date(year, month - 1, 1)), to: inputDate(new Date(year, month, 0)) };
    // O Date ajusta o mes negativo: no 1o trimestre, o anterior e outubro a dezembro do ano passado.
    case 'trimestre-passado':
      return { from: inputDate(new Date(year, (quarter - 1) * 3, 1)), to: inputDate(new Date(year, quarter * 3, 0)) };
    case 'ultimos-3-meses':
      return { from: inputDate(new Date(year, month - 3, today.getDate())), to: inputDate(today) };
    case 'este-ano':
      return { from: inputDate(new Date(year, 0, 1)), to: inputDate(today) };
    case 'ano-passado':
      return { from: inputDate(new Date(year - 1, 0, 1)), to: inputDate(new Date(year - 1, 11, 31)) };
    default:
      return null;
  }
}
