import type { Program } from '../types/api';

/**
 * Icones dos programas: desenhos de traco da biblioteca Lucide (licenca ISC, em components/programs/LUCIDE-LICENSE),
 * no mesmo estilo dos icones do app. As chaves sao as mesmas da API (Common/ProgramAppearance.cs); uma chave
 * desconhecida cai no padrao. A ordem agrupa por assunto (e a da grade de escolha); `color` e a cor da familia, que o
 * programa novo recebe junto com o icone; `keywords` sao inicios de palavra (sem acento) que, no nome do programa,
 * sugerem o icone. A API tem a mesma tabela de sugestao (ProgramAppearance.Suggest), para os programas criados na
 * importacao de planilha: mudou aqui, mude la.
 */
export const PROGRAM_ICONS: Array<{ key: string; label: string; color: string; keywords: string[]; body: string }> = [
  {
    key: 'banheiro',
    label: 'Banheiro',
    color: 'blue',
    keywords: ['banheir', 'sanitari', 'chuveir', 'privada'],
    body: '<path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/>'
  },
  {
    key: 'agua',
    label: 'Água e saneamento',
    color: 'blue',
    keywords: ['agua', 'cisterna', 'poco', 'chuva', 'hidric', 'hidraul', 'abastec', 'reservatori', 'esgot', 'saneament'],
    body: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>'
  },
  {
    key: 'horta',
    label: 'Horta',
    color: 'green',
    keywords: ['horta', 'plant', 'cultiv', 'agro', 'agricult', 'jardim', 'pomar', 'semente', 'canteir'],
    body: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>'
  },
  {
    key: 'arvore',
    label: 'Meio ambiente',
    color: 'green',
    keywords: ['arvor', 'arboriz', 'florest', 'reflorest', 'ambient', 'ecolog', 'praca', 'parque'],
    body: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>'
  },
  {
    key: 'reciclagem',
    label: 'Reciclagem',
    color: 'teal',
    keywords: ['recicl', 'residu', 'lixo', 'coleta', 'compost'],
    body: '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>'
  },
  {
    key: 'alimentacao',
    label: 'Alimentação',
    color: 'green',
    keywords: ['aliment', 'cozinha', 'comida', 'refeic', 'nutri', 'cesta', 'merenda'],
    body: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'
  },
  {
    key: 'obra',
    label: 'Obra e reforma',
    color: 'orange',
    keywords: ['obra', 'reforma', 'constru', 'alvenaria', 'restaur', 'ampliac', 'edific'],
    body: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>'
  },
  {
    key: 'casa',
    label: 'Moradia',
    color: 'orange',
    keywords: ['casa', 'moradi', 'habitac', 'residenc', 'domicil'],
    body: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
  },
  {
    key: 'manutencao',
    label: 'Manutenção e reparos',
    color: 'orange',
    keywords: ['manutenc', 'reparo', 'conserto', 'instalac'],
    body: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  },
  {
    key: 'mobilidade',
    label: 'Mobilidade e acesso',
    color: 'gray',
    keywords: ['passarela', 'ponte', 'pinguela', 'calcad', 'escada', 'estrada', 'travessia', 'mobilidad', 'transport'],
    body: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'
  },
  {
    key: 'energia',
    label: 'Energia e elétrica',
    color: 'amber',
    keywords: ['energi', 'eletric', 'luz', 'ilumin', 'fiac'],
    body: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'
  },
  {
    key: 'solar',
    label: 'Energia solar',
    color: 'amber',
    keywords: ['solar', 'fotovolt'],
    body: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
  },
  {
    key: 'educacao',
    label: 'Educação',
    color: 'purple',
    keywords: ['educa', 'escola', 'ensino', 'aula', 'alfabetiz', 'bibliotec', 'reforco', 'estud'],
    body: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'
  },
  {
    key: 'oficina',
    label: 'Oficina e capacitação',
    color: 'purple',
    keywords: ['oficina', 'capacit', 'curso', 'treinament', 'palestra', 'workshop', 'formac'],
    body: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>'
  },
  {
    key: 'comunidade',
    label: 'Comunidade',
    color: 'pink',
    keywords: ['comunidad', 'comunitari', 'associac', 'morador', 'coletiv', 'mobiliz', 'lideranc'],
    body: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  },
  {
    key: 'evento',
    label: 'Evento e campanha',
    color: 'pink',
    keywords: ['evento', 'mutirao', 'festa', 'feira', 'campanha', 'encontro'],
    body: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>'
  },
  {
    key: 'saude',
    label: 'Saúde',
    color: 'pink',
    keywords: ['saude', 'posto', 'clinic', 'hospital', 'medic', 'odonto', 'vacin'],
    body: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'
  },
  {
    key: 'acessibilidade',
    label: 'Acessibilidade',
    color: 'teal',
    keywords: ['acessib', 'rampa', 'cadeirant', 'deficien', 'inclus'],
    body: '<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>'
  },
  {
    key: 'diagnostico',
    label: 'Diagnóstico e levantamento',
    color: 'teal',
    keywords: ['diagnost', 'levantament', 'vistori', 'pesquis', 'mapeament', 'cadastr', 'censo', 'avaliac'],
    body: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'
  },
  {
    key: 'pin',
    label: 'Outro',
    color: 'teal',
    keywords: [],
    body: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
  }
];

export const PROGRAM_COLORS: Array<{ key: string; hex: string; label: string }> = [
  { key: 'teal', hex: '#0f766e', label: 'Verde-azulado' },
  { key: 'blue', hex: '#2563eb', label: 'Azul' },
  { key: 'green', hex: '#16a34a', label: 'Verde' },
  { key: 'amber', hex: '#b7791f', label: 'Amarelo' },
  { key: 'orange', hex: '#ea580c', label: 'Laranja' },
  { key: 'red', hex: '#dc2626', label: 'Vermelho' },
  { key: 'purple', hex: '#7c3aed', label: 'Roxo' },
  { key: 'pink', hex: '#db2777', label: 'Rosa' },
  { key: 'gray', hex: '#64748b', label: 'Cinza' }
];

export const DEFAULT_PROGRAM_ICON = 'pin';
export const DEFAULT_PROGRAM_COLOR = 'teal';

function programIcon(icon: string | null | undefined) {
  return PROGRAM_ICONS.find((item) => item.key === icon) ?? PROGRAM_ICONS[PROGRAM_ICONS.length - 1];
}

/** Desenho do icone (conteudo de um <svg viewBox="0 0 24 24">, de traco). */
export function programIconBody(icon: string | null | undefined) {
  return programIcon(icon).body;
}

export function programIconLabel(icon: string | null | undefined) {
  return programIcon(icon).label;
}

/** Cor da familia do icone: a que um programa novo recebe junto com ele. */
export function programIconColor(icon: string | null | undefined) {
  return programIcon(icon).color;
}

export function programHex(color: string | null | undefined) {
  return (PROGRAM_COLORS.find((item) => item.key === color) ?? PROGRAM_COLORS[0]).hex;
}

/**
 * Icone sugerido pelo nome do programa: vale a palavra-chave que aparece primeiro no nome ("Cisterna da Escola..."
 * e agua, nao educacao). Null quando nenhuma palavra bate.
 */
export function suggestProgramIcon(name: string) {
  const words = [...name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().matchAll(/[a-z0-9]+/g)];
  let best: { key: string; at: number } | null = null;
  for (const icon of PROGRAM_ICONS) {
    const word = words.find((match) => icon.keywords.some((keyword) => match[0].startsWith(keyword)));
    if (word && (best === null || word.index! < best.at)) best = { key: icon.key, at: word.index! };
  }
  return best?.key ?? null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "5 tarefas · 2 indicadores · textos sugeridos"; null quando o programa nao tem modelo. */
export function programTemplateSummary(program: Program) {
  const parts = [
    program.templateActivitiesCount > 0 ? plural(program.templateActivitiesCount, 'tarefa', 'tarefas') : null,
    program.templateIndicatorsCount > 0 ? plural(program.templateIndicatorsCount, 'indicador', 'indicadores') : null,
    program.hasTemplateTexts ? 'textos sugeridos' : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
