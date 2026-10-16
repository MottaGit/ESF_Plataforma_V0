import { useEffect, useRef } from 'react';
import { IconChevronLeft, IconChevronRight, IconClose, IconDownload } from './Icons';

export interface LightboxItem {
  url: string;
  caption: string | null;
  fileName: string;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Visualizador de fotos em tela cheia: setas (ou deslizar no celular) passam as fotos, Esc fecha. */
export function Lightbox({ items, index, onIndexChange, onClose }: LightboxProps) {
  const touchStartX = useRef<number | null>(null);
  const item = items[index];
  const hasMany = items.length > 1;

  const next = () => onIndexChange((index + 1) % items.length);
  const previous = () => onIndexChange((index - 1 + items.length) % items.length);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight' && hasMany) onIndexChange((index + 1) % items.length);
      else if (event.key === 'ArrowLeft' && hasMany) onIndexChange((index - 1 + items.length) % items.length);
    }

    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, items.length, hasMany, onClose, onIndexChange]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar foto"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (!hasMany || start === null || end === undefined || Math.abs(end - start) < 50) return;
        if (end < start) next();
        else previous();
      }}
    >
      <div className="lightbox__bar" onClick={(event) => event.stopPropagation()}>
        <span className="lightbox__count num">
          {index + 1} de {items.length}
        </span>
        <a
          className="lightbox__action"
          href={item.url}
          download={item.fileName}
          target="_blank"
          rel="noreferrer"
          aria-label="Baixar foto"
          title="Baixar"
        >
          <IconDownload size={18} />
        </a>
        <button type="button" className="lightbox__action" aria-label="Fechar" title="Fechar (Esc)" onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>

      <div className="lightbox__stage">
        {hasMany ? (
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev"
            aria-label="Foto anterior"
            onClick={(event) => {
              event.stopPropagation();
              previous();
            }}
          >
            <IconChevronLeft size={26} />
          </button>
        ) : null}
        <img src={item.url} alt={item.caption ?? item.fileName} onClick={(event) => event.stopPropagation()} />
        {hasMany ? (
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next"
            aria-label="Próxima foto"
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
          >
            <IconChevronRight size={26} />
          </button>
        ) : null}
      </div>

      <div className="lightbox__caption" onClick={(event) => event.stopPropagation()}>
        {item.caption ?? item.fileName}
      </div>
    </div>
  );
}
