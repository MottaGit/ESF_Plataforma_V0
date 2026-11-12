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

/**
 * Centro aproximado de um bairro (e cidade) no mapa, para a distancia ate a obra. Vai so o texto do bairro, sem o
 * nome de ninguem. null: nao achou (ou a busca falhou).
 */
export async function locateDistrict(district: string | null, city: string | null): Promise<{ lat: number; lng: number } | null> {
  const query = [district, city].map((part) => part?.trim()).filter(Boolean).join(', ');
  if (!query) return null;
  try {
    const [first] = await searchAddress(query);
    return first ? { lat: first.lat, lng: first.lng } : null;
  } catch {
    return null;
  }
}
