import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { programHex, programIconBody } from '../../utils/programs';

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
    html:
      `<span class="map-pin" style="--pin:${programHex(color)}">` +
      `<svg class="map-pin__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round">${programIconBody(icon)}</svg></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
  });
}

export { searchAddress, type PlaceResult } from '../../utils/geocode';

export { L };
