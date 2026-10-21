import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Field, TextArea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface BlockActivityDialogProps {
  title: string;
  onCancel: () => void;
  /** Motivo ja limpo (null quando a pessoa nao escreveu nada). */
  onConfirm: (reason: string | null) => void;
}

/** Ao mover uma atividade para "Bloqueada": pergunta (sem obrigar) o que esta travando. */
export function BlockActivityDialog({ title, onCancel, onConfirm }: BlockActivityDialogProps) {
  const [reason, setReason] = useState('');

  function confirm(event?: FormEvent) {
    event?.preventDefault();
    onConfirm(reason.trim() || null);
  }

  return (
    <Modal
      title="Bloquear tarefa"
      subtitle={title}
      size="narrow"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={() => confirm()}>
            Bloquear
          </Button>
        </>
      }
    >
      <form onSubmit={confirm}>
        <Field
          label="O que está travando?"
          htmlFor="block-reason"
          hint="Opcional. Aparece no card e no Precisa de atenção, para quem puder ajudar."
        >
          <TextArea
            id="block-reason"
            autoFocus
            maxLength={300}
            value={reason}
            placeholder="Ex.: aguardando a doação do material"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
