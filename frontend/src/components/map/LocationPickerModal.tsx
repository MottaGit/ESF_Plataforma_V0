import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconSearch } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { DEFAULT_CENTER, L, createMap, programPin, searchAddress, type PlaceResult } from './leaflet';

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

interface LocationPickerModalProps {
  /** Ponto ja marcado (null: ainda nao marcado). */
  initial: PickedLocation | null;
  /** Endereco do formulario, usado na busca. */
  address: string;
  /** Icone e cor do programa, para o pino ficar igual ao do mapa de projetos. */
  icon: string;
  color: string;
  onClose: () => void;
  /** null remove a localizacao. */
  onConfirm: (location: PickedLocation | null) => void;
}

/**
 * "Marcar no mapa": busca o endereco no OpenStreetMap ou recebe um clique no mapa; o pino pode ser arrastado
 * para ajustar. Ninguem precisa digitar coordenadas.
 */
export function LocationPickerModal({ initial, address, icon, color, onClose, onConfirm }: LocationPickerModalProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  const [position, setPosition] = useState<PickedLocation | null>(initial);
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function place(latitude: number, longitude: number, zoom?: number) {
    const current = map.current;
    if (!current) return;
    const point = L.latLng(latitude, longitude);
    if (!marker.current) {
      marker.current = L.marker(point, { draggable: true, icon: programPin(icon, color), autoPan: true }).addTo(current);
      marker.current.on('dragend', () => {
        const moved = marker.current!.getLatLng();
        setPosition({ latitude: moved.lat, longitude: moved.lng });
      });
    } else {
      marker.current.setLatLng(point);
    }
    if (zoom) current.setView(point, zoom);
    setPosition({ latitude, longitude });
  }

  useEffect(() => {
    if (!element.current) return;
    const created = createMap(
      element.current,
      initial ? [initial.latitude, initial.longitude] : DEFAULT_CENTER,
      initial ? 17 : 12
    );
    map.current = created;
    created.on('click', (event: L.LeafletMouseEvent) => {
      place(event.latlng.lat, event.latlng.lng);
      setResults([]);
    });
    if (initial) place(initial.latitude, initial.longitude);
    // O modal termina de abrir depois do mapa: recalcula o tamanho.
    const timer = window.setTimeout(() => created.invalidateSize(), 150);
    return () => {
      window.clearTimeout(timer);
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // O mapa e criado uma vez; o pino segue o estado depois.
  }, []);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setMessage(null);
    setResults([]);
    try {
      const found = await searchAddress(query.trim());
      if (found.length === 0) {
        setMessage('Endereço não encontrado. Tente só a rua e a cidade, ou clique no mapa no lugar certo.');
      } else if (found.length === 1) {
        place(found[0].lat, found[0].lng, 17);
      } else {
        setResults(found);
      }
    } catch {
      setMessage('A busca de endereço não respondeu. Clique no mapa no lugar do projeto.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal
      title="Marcar no mapa"
      subtitle="Busque pelo endereço ou clique no mapa; arraste o pino para ajustar."
      size="wide"
      onClose={onClose}
      footer={
        <>
          {initial ? (
            <Button variant="ghost" onClick={() => onConfirm(null)}>
              Remover localização
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!position} onClick={() => position && onConfirm(position)}>
            Usar esta localização
          </Button>
        </>
      }
    >
      <form className="location-search" onSubmit={search}>
        <span className="search">
          <IconSearch className="search__icon" />
          <TextInput
            value={query}
            placeholder="Rua, número, bairro, cidade"
            aria-label="Endereço"
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
        <Button type="submit" loading={searching}>
          Buscar
        </Button>
      </form>

      {message ? (
        <div style={{ marginBottom: 10 }}>
          <Alert kind="info">{message}</Alert>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="location-results">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => {
                  place(result.lat, result.lng, 17);
                  setResults([]);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={element} className="location-map" role="region" aria-label="Mapa para marcar o local do projeto" />
      <p className="field__hint" style={{ marginTop: 8 }}>
        {position
          ? `Pino em ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}.`
          : 'Nenhum ponto marcado ainda.'}{' '}
        Mapa: © OpenStreetMap.
      </p>
    </Modal>
  );
}
