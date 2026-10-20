import { useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import type { Program } from '../../types/api';
import { DEFAULT_PROGRAM_COLOR, DEFAULT_PROGRAM_ICON, PROGRAM_COLORS, PROGRAM_ICONS, programHex } from '../../utils/programs';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface ProgramFormModalProps {
  /** null cria um programa novo; com um programa, edita nome, icone e cor. */
  program: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}

/** Criar ou editar um programa (agrupamento de projetos): nome, icone e cor (usados nos cards e no mapa). */
export function ProgramFormModal({ program, onClose, onSaved }: ProgramFormModalProps) {
  const [name, setName] = useState(program?.name ?? '');
  const [icon, setIcon] = useState(program?.icon ?? DEFAULT_PROGRAM_ICON);
  const [color, setColor] = useState(program?.color ?? DEFAULT_PROGRAM_COLOR);
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
        ? await programsApi.update(program.id, { name: name.trim(), status: program.status, icon, color })
        : await programsApi.create({ name: name.trim(), icon, color });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o programa.');
    } finally {
      setSaving(false);
    }
  }

  const accent = { '--program-color': programHex(color) } as CSSProperties;

  return (
    <Modal
      title={program ? 'Editar programa' : 'Novo programa'}
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
      <form onSubmit={handleSubmit} className="form-grid form-grid--single">
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

        <Field label="Ícone" hint="Aparece nos cards e nos pinos do mapa.">
          <div className="icon-picker" role="radiogroup" aria-label="Ícone" style={accent}>
            {PROGRAM_ICONS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={icon === item.key}
                aria-label={item.label}
                title={item.label}
                className={`icon-picker__option${icon === item.key ? ' icon-picker__option--active' : ''}`}
                onClick={() => setIcon(item.key)}
              >
                <span aria-hidden="true">{item.emoji}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Cor">
          <div className="color-picker" role="radiogroup" aria-label="Cor">
            {PROGRAM_COLORS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={color === item.key}
                aria-label={item.label}
                title={item.label}
                className={`color-picker__option${color === item.key ? ' color-picker__option--active' : ''}`}
                style={{ background: item.hex }}
                onClick={() => setColor(item.key)}
              />
            ))}
          </div>
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
