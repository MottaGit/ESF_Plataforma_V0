import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  title: string;
  subtitle?: string;
  size?: 'narrow' | 'default' | 'wide';
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  /** false: sem botao de fechar, sem Esc e sem clique fora (ex.: aceite obrigatorio da politica). */
  closable?: boolean;
}

// Modais abertos, do mais antigo ao mais recente: um pode abrir por cima de outro (ex.: "Novo programa" dentro do
// formulario de projeto). Esc fecha so o de cima, e a pagina so volta a rolar quando o ultimo fecha.
const openModals: symbol[] = [];

export function Modal({ title, subtitle, size = 'default', onClose, footer, children, closable = true }: ModalProps) {
  const onCloseRef = useRef(closable ? onClose : () => undefined);
  onCloseRef.current = closable ? onClose : () => undefined;

  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      openModals.splice(openModals.indexOf(id), 1);
      if (openModals.length === 0) document.body.style.overflow = '';
    };
  }, []);

  const sizeClass = size === 'wide' ? ' modal--wide' : size === 'narrow' ? ' modal--narrow' : '';

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => closable && event.target === event.currentTarget && onClose()}
    >
      <div className={`modal${sizeClass}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <div>
            <div className="modal__title">{title}</div>
            {subtitle ? <div className="modal__subtitle">{subtitle}</div> : null}
          </div>
          {closable ? (
            <button type="button" className="icon-button" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Fechar">
              <IconClose />
            </button>
          ) : null}
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
