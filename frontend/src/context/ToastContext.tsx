import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { IconClose } from '../components/ui/Icons';

interface Toast {
  id: number;
  message: string;
  kind: 'default' | 'error';
}

interface ToastContextValue {
  notify: (message: string) => void;
  notifyError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: Toast['kind']) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, kind }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify: (message: string) => push(message, 'default'),
      notifyError: (message: string) => push(message, 'error')
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`} role="status">
            <span>{toast.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Fechar aviso">
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider.');
  return context;
}
