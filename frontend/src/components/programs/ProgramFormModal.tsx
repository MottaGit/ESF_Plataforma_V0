import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import type { Program } from '../../types/api';
import { DEFAULT_PROGRAM_COLOR, DEFAULT_PROGRAM_ICON, programIconColor, suggestProgramIcon } from '../../utils/programs';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ProgramLookField } from './ProgramLookField';

interface ProgramFormModalProps {
  onClose: () => void;
  onSaved: (program: Program) => void;
}

/**
 * Programa novo (agrupamento de projetos): nome, icone e cor. O icone sai do nome enquanto a pessoa digita (e a cor
 * vem com ele); a grade com todos fica em "Trocar". O resto (texto, modelo, parceiros) fica em Editar programa.
 */
export function ProgramFormModal({ onClose, onSaved }: ProgramFormModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_PROGRAM_ICON);
  const [color, setColor] = useState(DEFAULT_PROGRAM_COLOR);
  // Escolhidos a mao: o nome deixa de mexer neles.
  const [iconChosen, setIconChosen] = useState(false);
  const [colorChosen, setColorChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeName(value: string) {
    setName(value);
    setError(null);
    if (iconChosen) return;
    const suggested = suggestProgramIcon(value) ?? DEFAULT_PROGRAM_ICON;
    setIcon(suggested);
    if (!colorChosen) setColor(programIconColor(suggested));
  }

  function chooseIcon(key: string) {
    setIcon(key);
    setIconChosen(true);
    if (!colorChosen) setColor(programIconColor(key));
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3) {
      setError('Informe um nome com ao menos 3 caracteres.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onSaved(await programsApi.create({ name: name.trim(), icon, color }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o programa.');
    } finally {
      setSaving(false);
    }
  }

  const lookHint = !iconChosen
    ? name.trim()
      ? 'Escolhido pelo nome do programa.'
      : 'Escolhido pelo nome, conforme você digita.'
    : 'Aparece na lista de programas, nos projetos e no mapa.';

  return (
    <Modal
      guardChanges
      title="Novo programa"
      subtitle="Programas agrupam projetos, como os banheiros ou as hortas. Um programa pode ter um projeto só."
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Criar programa
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form-grid form-grid--single">
        <Field label="Nome" htmlFor="program-name" required error={error ?? undefined}>
          <TextInput
            id="program-name"
            autoFocus
            value={name}
            invalid={Boolean(error)}
            placeholder="Ex.: Banheiro Direito da Gente"
            onChange={(event) => changeName(event.target.value)}
          />
        </Field>

        <ProgramLookField
          icon={icon}
          color={color}
          hint={lookHint}
          onIcon={chooseIcon}
          onColor={(key) => {
            setColor(key);
            setColorChosen(true);
          }}
        />
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
