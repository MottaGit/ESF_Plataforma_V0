import type { ProjectDetail } from '../../types/api';
import { Alert } from '../ui/Feedback';

export function LocationTab({ project }: { project: ProjectDetail }) {
  const hasCoordinates = project.latitude != null && project.longitude != null;

  const mapSrc = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(project.longitude as number) - 0.006}%2C${
        (project.latitude as number) - 0.004
      }%2C${(project.longitude as number) + 0.006}%2C${(project.latitude as number) + 0.004}&layer=mapnik&marker=${
        project.latitude
      }%2C${project.longitude}`
    : '';

  const addressLine = [project.address, project.district, project.city, project.state].filter(Boolean).join(', ');

  return (
    <div className="panel">
      <div className="panel__body">
        <div className="meta-list meta-list--cols" style={{ marginBottom: 16 }}>
          <div>
            <div className="meta__label">Endereço</div>
            <div className="meta__value">{project.address ?? '—'}</div>
          </div>
          <div>
            <div className="meta__label">Bairro</div>
            <div className="meta__value">{project.district ?? '—'}</div>
          </div>
          <div>
            <div className="meta__label">Cidade</div>
            <div className="meta__value">{project.city ?? '—'}</div>
          </div>
          <div>
            <div className="meta__label">Estado</div>
            <div className="meta__value">{project.state ?? '—'}</div>
          </div>
          <div>
            <div className="meta__label">Coordenadas</div>
            <div className="meta__value num">
              {hasCoordinates ? `${project.latitude}, ${project.longitude}` : '—'}
            </div>
          </div>
        </div>

        {hasCoordinates ? (
          <>
            <iframe className="map-frame" src={mapSrc} title={`Mapa de ${project.name}`} loading="lazy" />
            <p className="field__hint" style={{ marginTop: 8 }}>
              <a
                href={`https://www.openstreetmap.org/?mlat=${project.latitude}&mlon=${project.longitude}#map=17/${project.latitude}/${project.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir mapa em tela cheia
              </a>
              {addressLine ? ` · ${addressLine}` : ''}
            </p>
          </>
        ) : (
          <Alert kind="info">
            Informe latitude e longitude na edição do projeto para exibir o mapa. O endereço sozinho já aparece nos
            relatórios.
          </Alert>
        )}
      </div>
    </div>
  );
}
