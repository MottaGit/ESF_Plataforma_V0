import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { programEmoji, programHex } from '../../utils/programs';

/** Mapa base gratuito do OpenStreetMap (a atribuicao e obrigatoria). */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Sem nenhum ponto marcado, o mapa abre em Porto Alegre. */
export const DEFAULT_CENTER: L.LatLngTuple = [-30.0346, -51.2177];

export function createMap(element: HTMLElement, center: L.LatLngTuple = DEFAULT_CENTER, zoom = 12) {
  const map = L.map(element, { center, zoom, scrollWheelZoom: true });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>');
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
  return map;
}

/** Pino com o icone e a cor do programa. */
export function programPin(icon: string, color: string) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin" style="--pin:${programHex(color)}"><span class="map-pin__icon">${programEmoji(icon)}</span></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
  });
}

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

export { L };
