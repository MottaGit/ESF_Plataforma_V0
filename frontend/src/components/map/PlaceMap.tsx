import { useEffect, useRef } from 'react';
import { DEFAULT_CENTER, L, createMap } from './leaflet';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface PlaceMapProps {
  /** Ponto do bairro (mostrado como uma area, nunca como um pino de casa). */
  point: MapPoint | null;
  /** Centro do mapa enquanto nao ha ponto (a cidade do nucleo). */
  center?: MapPoint | null;
  /** Com esta funcao, tocar no mapa escolhe o ponto. */
  onPick?: (point: MapPoint) => void;
}

/** Raio da area desenhada em volta do ponto: mostra "por aqui", sem apontar um endereco. */
const AREA_RADIUS_M = 600;

/**
 * Mapa pequeno do bairro do voluntario: confirma o lugar escolhido na busca ou, com onPick, recebe um toque perto de
 * onde a pessoa mora. Carregado sob demanda, como os outros mapas.
 */
export function PlaceMap({ point, center, onPick }: PlaceMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const area = useRef<L.Circle | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!element.current) return;
    const start = point ?? center;
    const created = createMap(element.current, start ? [start.lat, start.lng] : DEFAULT_CENTER, point ? 14 : 12);
    map.current = created;
    created.on('click', (event: L.LeafletMouseEvent) => pick.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }));
    // A janela termina de abrir depois do mapa: recalcula o tamanho.
    const timer = window.setTimeout(() => created.invalidateSize(), 150);
    return () => {
      window.clearTimeout(timer);
      created.remove();
      map.current = null;
      area.current = null;
    };
    // O mapa e criado uma vez; a area segue o ponto depois.
  }, []);

  useEffect(() => {
    const current = map.current;
    if (!current) return;
    if (!point) {
      area.current?.remove();
      area.current = null;
      return;
    }
    const where = L.latLng(point.lat, point.lng);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || undefined;
    if (!area.current) {
      area.current = L.circle(where, { radius: AREA_RADIUS_M, color, fillColor: color, fillOpacity: 0.2, weight: 2 }).addTo(current);
    } else {
      area.current.setLatLng(where);
    }
    current.setView(where, Math.max(current.getZoom(), 13));
  }, [point?.lat, point?.lng]);

  // Sem ponto, o mapa vai para a cidade assim que ela e achada.
  useEffect(() => {
    if (!point && center && map.current) map.current.setView([center.lat, center.lng], 12);
  }, [center?.lat, center?.lng]);

  return (
    <div
      ref={element}
      className={`place-map${onPick ? ' place-map--pick' : ''}`}
      role="application"
      aria-label={onPick ? 'Mapa: toque perto de onde mora' : 'Mapa do bairro'}
    />
  );
}
