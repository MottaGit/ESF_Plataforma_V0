import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './Button';

/** Lado da area de enquadramento na tela e da imagem final gerada (px). */
const VIEWPORT = 260;
const OUTPUT = 400;
const MAX_ZOOM = 3;

interface PhotoCropperProps {
  file: File;
  onCancel: () => void;
  /** Recebe a imagem final (quadrada, JPEG) e um endereco local para pre-visualizar. */
  onConfirm: (photo: Blob, previewUrl: string) => void;
}

interface Placement {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Enquadramento da foto: a pessoa arrasta a imagem e ajusta o zoom para escolher o circulo que
 * vai aparecer como a "bolinha" do voluntario. Gera um quadrado de 400x400 com o que esta no circulo.
 */
export function PhotoCropper({ file, onCancel, onConfirm }: PhotoCropperProps) {
  const [source, setSource] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  // Carrega a imagem escolhida (lida como data URL, que nao precisa ser liberada depois).
  // Eventos de uma carga ja descartada (troca de arquivo, desmontagem) sao ignorados.
  useEffect(() => {
    let active = true;
    const fail = () => {
      if (active) setError('Não foi possível abrir essa imagem. Use uma foto JPG, PNG ou WEBP.');
    };

    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = () => {
      if (!active || typeof reader.result !== 'string') return;
      const url = reader.result;
      const img = new Image();
      img.onload = () => {
        if (!active) return;
        setError(null);
        setImage(img);
        setSource(url);
        setPlacement(centered(img, 1));
      };
      img.onerror = fail;
      img.src = url;
    };
    reader.readAsDataURL(file);

    return () => {
      active = false;
    };
  }, [file]);

  // Escala em que o menor lado da imagem cobre exatamente o circulo (zoom 1).
  const baseScale = image ? VIEWPORT / Math.min(image.naturalWidth, image.naturalHeight) : 1;

  function clamp(next: Placement): Placement {
    if (!image) return next;
    const width = image.naturalWidth * baseScale * next.zoom;
    const height = image.naturalHeight * baseScale * next.zoom;
    return {
      zoom: next.zoom,
      x: Math.min(0, Math.max(VIEWPORT - width, next.x)),
      y: Math.min(0, Math.max(VIEWPORT - height, next.y))
    };
  }

  function centered(img: HTMLImageElement, zoom: number): Placement {
    const scale = (VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
    return { zoom, x: (VIEWPORT - img.naturalWidth * scale) / 2, y: (VIEWPORT - img.naturalHeight * scale) / 2 };
  }

  /** Zoom mantendo fixo o ponto que esta no centro do circulo. */
  function changeZoom(zoom: number) {
    setPlacement((current) => {
      const ratio = zoom / current.zoom;
      const center = VIEWPORT / 2;
      return clamp({ zoom, x: center - (center - current.x) * ratio, y: center - (center - current.y) * ratio });
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, x: placement.x, y: placement.y };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    setPlacement((current) =>
      clamp({ ...current, x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY })
    );
  }

  // Setas do teclado tambem movem a imagem (e + / - mudam o zoom).
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 30 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setPlacement((current) => clamp({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (event.key === '+' || event.key === '=') {
      changeZoom(Math.min(MAX_ZOOM, placement.zoom + 0.1));
    } else if (event.key === '-') {
      changeZoom(Math.max(1, placement.zoom - 0.1));
    }
  }

  function confirm() {
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Recorta da imagem original exatamente o quadrado visivel (o circulo inscrito nele).
    const scale = baseScale * placement.zoom;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT, OUTPUT);
    context.drawImage(image, -placement.x / scale, -placement.y / scale, VIEWPORT / scale, VIEWPORT / scale, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob, URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.9
    );
  }

  if (error) {
    return (
      <div className="cropper">
        <p className="field__error">{error}</p>
        <Button small onClick={onCancel}>
          Voltar
        </Button>
      </div>
    );
  }

  const scale = baseScale * placement.zoom;

  return (
    <div className="cropper">
      <div
        className="cropper__viewport"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        role="group"
        aria-label="Enquadramento da foto: arraste para posicionar"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={handleKeyDown}
        onWheel={(event) => changeZoom(Math.min(MAX_ZOOM, Math.max(1, placement.zoom - event.deltaY * 0.002)))}
      >
        {source && image ? (
          <img
            src={source}
            alt=""
            draggable={false}
            style={{
              left: placement.x,
              top: placement.y,
              width: image.naturalWidth * scale,
              height: image.naturalHeight * scale
            }}
          />
        ) : (
          <span className="cropper__loading">Carregando…</span>
        )}
        <span className="cropper__mask" aria-hidden="true" />
      </div>

      <label className="cropper__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={placement.zoom}
          aria-label="Zoom da foto"
          onChange={(event) => changeZoom(Number(event.target.value))}
        />
      </label>
      <p className="field__hint">Arraste a foto para escolher o que fica dentro do círculo.</p>

      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <Button small onClick={onCancel}>
          Cancelar
        </Button>
        <Button small variant="primary" disabled={!image} onClick={confirm}>
          Usar foto
        </Button>
      </div>
    </div>
  );
}
