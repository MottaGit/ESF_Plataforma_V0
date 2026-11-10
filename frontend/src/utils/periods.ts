/** Data local no formato do campo de data (aaaa-mm-dd). */
export function inputDate(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

export interface PeriodShortcut {
  /** Nome do atalho na URL (?periodo=): o link guarda "trimestre passado", nao as datas de hoje. */
  key: string;
  label: string;
  /** aaaa-mm-dd; vazio nas duas pontas: todo o historico. */
  from: string;
  to: string;
}

/**
 * Atalhos de periodo, pelo calendario de quem esta usando (relatorios e painel nacional). Os fechados (mes, trimestre
 * e ano passados) sao os da prestacao de contas: em janeiro, "Este ano" nao serve para o relatorio anual.
 */
export function periodShortcuts(today = new Date(), withAll = true): PeriodShortcut[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const quarter = Math.floor(month / 3);
  const shortcuts: PeriodShortcut[] = [
    {
      key: 'mes-passado',
      label: 'Mês passado',
      from: inputDate(new Date(year, month - 1, 1)),
      to: inputDate(new Date(year, month, 0))
    },
    // O Date ajusta o mes negativo: no 1o trimestre, o anterior e outubro a dezembro do ano passado.
    {
      key: 'trimestre-passado',
      label: 'Trimestre passado',
      from: inputDate(new Date(year, (quarter - 1) * 3, 1)),
      to: inputDate(new Date(year, quarter * 3, 0))
    },
    {
      key: 'ultimos-3-meses',
      label: 'Últimos 3 meses',
      from: inputDate(new Date(year, month - 3, today.getDate())),
      to: inputDate(today)
    },
    { key: 'este-ano', label: 'Este ano', from: inputDate(new Date(year, 0, 1)), to: inputDate(today) },
    {
      key: 'ano-passado',
      label: 'Ano passado',
      from: inputDate(new Date(year - 1, 0, 1)),
      to: inputDate(new Date(year - 1, 11, 31))
    }
  ];
  return withAll ? [...shortcuts, { key: 'tudo', label: 'Tudo', from: '', to: '' }] : shortcuts;
}
