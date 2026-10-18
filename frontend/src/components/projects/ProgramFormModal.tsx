import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import type { Program } from '../../types/api';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface ProgramFormModalProps {
  /** null cria um programa novo; com um programa, renomeia. */
  program: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}

/** Criar ou renomear um programa (agrupamento de projetos). */
export function ProgramFormModal({ program, onClose, onSaved }: ProgramFormModalProps) {
  const [name, setName] = useState(program?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3) {
      setError('Informe um nome com ao menos 3 caracteres.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = program
        ? await programsApi.update(program.id, { name: name.trim(), status: program.status })
        : await programsApi.create({ name: name.trim() });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o programa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={program ? 'Renomear programa' : 'Novo programa'}
      subtitle="Programas agrupam projetos do mesmo tipo, como reformas de banheiro ou hortas."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            {program ? 'Salvar' : 'Criar programa'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Field label="Nome" htmlFor="program-name" required error={error ?? undefined}>
          <TextInput
            id="program-name"
            autoFocus
            value={name}
            invalid={Boolean(error)}
            placeholder="Ex.: Banheiro Direito da Gente"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}
