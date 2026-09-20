import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner spinner--lg" />
      {label}
    </div>
  );
}

interface AlertProps {
  kind?: 'error' | 'warning' | 'info';
  children: ReactNode;
}

export function Alert({ kind = 'info', children }: AlertProps) {
  return <div className={`alert alert--${kind}`}>{children}</div>;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {description ? <p className="empty__text">{description}</p> : null}
      {action}
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  destructive,
  busy,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      size="narrow"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{message}</p>
    </Modal>
  );
}
