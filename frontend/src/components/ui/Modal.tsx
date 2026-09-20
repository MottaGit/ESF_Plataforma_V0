import { useEffect, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  title: string;
  subtitle?: string;
  size?: 'narrow' | 'default' | 'wide';
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ title, subtitle, size = 'default', onClose, footer, children }: ModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const sizeClass = size === 'wide' ? ' modal--wide' : size === 'narrow' ? ' modal--narrow' : '';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal${sizeClass}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <div>
            <div className="modal__title">{title}</div>
            {subtitle ? <div className="modal__subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="icon-button" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Fechar">
            <IconClose />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
