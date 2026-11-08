import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
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
  /**
   * Janela de formulario: depois que a pessoa digitou ou escolheu algo, o clique fora e o Esc (os dois que acontecem
   * sem querer) perguntam antes de fechar. O X e o "Cancelar" continuam fechando direto.
   */
  guardChanges?: boolean;
}

// Modais abertos, do mais antigo ao mais recente: um pode abrir por cima de outro (ex.: "Novo programa" dentro do
// formulario de projeto). Esc fecha so o de cima, e a pagina so volta a rolar quando o ultimo fecha.
const openModals: symbol[] = [];

export function Modal({
  title,
  subtitle,
  size = 'default',
  onClose,
  footer,
  children,
  closable = true,
  guardChanges = false
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Algo foi digitado ou escolhido dentro da janela (eventos input/change de qualquer campo, inclusive o editor).
  const touchedRef = useRef(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Fechar "sem querer" (Esc, clique fora): pergunta antes quando ha algo preenchido.
  const requestCloseRef = useRef<() => void>(() => undefined);
  requestCloseRef.current = () => {
    if (!closable) return;
    if (guardChanges && touchedRef.current) setConfirmingDiscard(true);
    else onClose();
  };

  // Trocar de modo (ex.: ler -> editar) recomeca a contagem do que foi preenchido.
  useEffect(() => {
    touchedRef.current = false;
  }, [guardChanges]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const markTouched = () => {
      touchedRef.current = true;
    };
    node.addEventListener('input', markTouched);
    node.addEventListener('change', markTouched);
    return () => {
      node.removeEventListener('input', markTouched);
      node.removeEventListener('change', markTouched);
    };
  }, []);

  useEffect(() => {
    const id = Symbol('modal');
    openModals.push(id);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) requestCloseRef.current();
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
      onMouseDown={(event) => event.target === event.currentTarget && requestCloseRef.current()}
    >
      <div className={`modal${sizeClass}`} role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
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

      {confirmingDiscard ? (
        <Modal
          title="Descartar o que foi preenchido?"
          size="narrow"
          onClose={() => setConfirmingDiscard(false)}
          footer={
            <>
              <Button onClick={() => setConfirmingDiscard(false)}>Continuar preenchendo</Button>
              <Button variant="danger" onClick={onClose}>
                Descartar
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            O que você preencheu em “{title}” ainda não foi salvo e será perdido.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
