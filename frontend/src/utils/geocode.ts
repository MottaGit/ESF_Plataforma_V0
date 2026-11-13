/*
 * Busca de enderecos e bairros no OpenStreetMap (Nominatim), fora do Leaflet: quem so precisa achar um ponto (o
 * bairro do voluntario) nao carrega o mapa.
 */

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Procura um endereco no OpenStreetMap (Nominatim). So e chamado quando a pessoa pede (um pedido por busca),
 * como pede a politica de uso do servico.
 */
export async function searchAddress(query: string): Promise<PlaceResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('accept-language', 'pt-BR');
  url.searchParams.set('q', query);
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('busca indisponivel');
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((item) => ({ label: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
}

/** Um bairro (ou uma cidade inteira) achado na busca, com o centro aproximado dele. */
export interface PlaceOption {
  /** null: a cidade inteira, sem bairro. */
  district: string | null;
  city: string | null;
  /** Sigla do estado ("RS"), quando o mapa informa. */
  uf: string | null;
  lat: number;
  lng: number;
}

/** O que conta como lugar onde se mora: bairros, vilas e cidades (ruas e enderecos ficam de fora). */
const AREA_TYPES = new Set(['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough', 'city', 'town', 'village', 'hamlet', 'municipality']);
const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality']);

interface NominatimPlace {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
}

/**
 * Procura um bairro no OpenStreetMap (um pedido por busca, quando a pessoa toca em Buscar, como pede a politica de uso
 * do servico; nada de sugerir a cada letra). Sem virgula, procura na cidade do nucleo: "Restinga" acha a de Porto
 * Alegre, nao a cidade de Sao Paulo. Vai so o texto procurado, sem o nome de ninguem.
 */
export async function searchPlaces(text: string, nucleoCity: string | null): Promise<PlaceOption[]> {
  const typed = text.trim();
  const query = typed.includes(',') || !nucleoCity ? typed : `${typed}, ${nucleoCity}`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '10');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('accept-language', 'pt-BR');
  url.searchParams.set('q', query);
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('busca indisponivel');
  const data = (await response.json()) as NominatimPlace[];

  const seen = new Set<string>();
  const options: PlaceOption[] = [];
  for (const item of data) {
    if (!item.addresstype || !AREA_TYPES.has(item.addresstype)) continue;
    const address = item.address ?? {};
    const isCity = CITY_TYPES.has(item.addresstype);
    const name = item.name || item.display_name.split(',')[0].trim();
    const city = isCity ? name : address.city ?? address.town ?? address.village ?? address.municipality ?? null;
    const uf = (address['ISO3166-2-lvl4'] ?? '').replace(/^BR-/, '') || null;
    const option: PlaceOption = { district: isCity ? null : name, city, uf, lat: Number(item.lat), lng: Number(item.lon) };
    const key = `${option.district ?? ''}|${option.city ?? ''}|${uf ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  return options;
}
