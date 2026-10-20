import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProjectListItem } from '../../types/api';
import { projectStatusLabel } from '../../utils/format';
import { ProgramMark } from '../programs/ProgramMark';
import { L, createMap, programPin } from './leaflet';

interface ProjectsMapProps {
  /** Os projetos da listagem (com os mesmos filtros da lista). */
  projects: ProjectListItem[];
  /** Projeto para centralizar e abrir ao carregar (vindo de "Ver no mapa"). */
  focusId?: string | null;
}

/** Popup do pino: nome (leva ao projeto), programa e status, bairro e cidade. */
function popupContent(project: ProjectListItem, open: (path: string) => void) {
  const root = document.createElement('div');
  root.className = 'map-popup';

  const title = document.createElement('a');
  title.className = 'map-popup__title';
  title.href = `/projetos/${project.id}`;
  title.textContent = project.name;
  title.addEventListener('click', (event) => {
    event.preventDefault();
    open(`/projetos/${project.id}`);
  });

  const meta = document.createElement('div');
  meta.className = 'map-popup__meta';
  meta.textContent = `${project.programName} · ${projectStatusLabel(project.status)}`;

  root.append(title, meta);
  const place = [project.district, project.city].filter(Boolean).join(', ');
  if (place) {
    const where = document.createElement('div');
    where.className = 'map-popup__meta';
    where.textContent = place;
    root.append(where);
  }
  return root;
}

/** Mapa dos projetos: um pino por projeto marcado, com o icone e a cor do programa. */
export function ProjectsMap({ projects, focusId }: ProjectsMapProps) {
  const navigate = useNavigate();
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  const located = useMemo(
    () => projects.filter((project) => project.latitude != null && project.longitude != null),
    [projects]
  );
  const missing = projects.filter((project) => project.latitude == null || project.longitude == null);

  // Legenda: os programas que aparecem no mapa.
  const legend = useMemo(() => {
    const byProgram = new Map<string, { name: string; icon: string; color: string; count: number }>();
    located.forEach((project) => {
      const entry = byProgram.get(project.programId) ?? {
        name: project.programName,
        icon: project.programIcon,
        color: project.programColor,
        count: 0
      };
      entry.count += 1;
      byProgram.set(project.programId, entry);
    });
    return [...byProgram.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [located]);

  useEffect(() => {
    if (!element.current) return;
    const created = createMap(element.current);
    layer.current = L.layerGroup().addTo(created);
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const current = map.current;
    const group = layer.current;
    if (!current || !group) return;

    group.clearLayers();
    const markers = located.map((project) => {
      const marker = L.marker([project.latitude!, project.longitude!], {
        icon: programPin(project.programIcon, project.programColor),
        title: project.name,
        alt: project.name
      });
      marker.bindPopup(() => popupContent(project, navigate));
      group.addLayer(marker);
      return { id: project.id, marker };
    });

    const focused = markers.find((item) => item.id === focusId)?.marker;
    const points = markers.map((item) => item.marker.getLatLng());
    if (focused) {
      current.setView(focused.getLatLng(), 16);
      focused.openPopup();
    } else if (points.length === 1) {
      current.setView(points[0], 15);
    } else if (points.length > 1) {
      current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    }
  }, [located, focusId, navigate]);

  return (
    <div className="projects-map">
      <div ref={element} className="projects-map__canvas" role="region" aria-label="Mapa dos projetos" />

      <div className="projects-map__foot">
        {legend.length > 0 ? (
          <ul className="map-legend">
            {legend.map((item) => (
              <li key={item.name}>
                <ProgramMark icon={item.icon} color={item.color} size={22} />
                {item.name}
                <span className="map-legend__count num">{item.count}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {missing.length > 0 ? (
          <details className="map-missing">
            <summary>
              {missing.length === 1
                ? '1 projeto sem localização não aparece no mapa'
                : `${missing.length} projetos sem localização não aparecem no mapa`}
            </summary>
            <p className="field__hint">Para incluir, abra o projeto e use Editar projeto › Marcar no mapa.</p>
            <ul>
              {missing.map((project) => (
                <li key={project.id}>
                  <Link to={`/projetos/${project.id}`}>{project.name}</Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
