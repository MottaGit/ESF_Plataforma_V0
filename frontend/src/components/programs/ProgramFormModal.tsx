import { useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { programsApi } from '../../api/endpoints';
import type { Program } from '../../types/api';
import {
  DEFAULT_PROGRAM_COLOR,
  DEFAULT_PROGRAM_ICON,
  PROGRAM_COLORS,
  PROGRAM_ICONS,
  programHex,
  programIconColor,
  programIconLabel,
  suggestProgramIcon
} from '../../utils/programs';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ProgramIcon, ProgramMark } from './ProgramMark';

interface ProgramFormModalProps {
  /** null cria um programa novo; com um programa, edita nome, icone e cor. */
  program: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}

/**
 * Criar ou editar um programa (agrupamento de projetos). No programa novo, o icone sai do nome enquanto a pessoa
 * digita (e a cor vem com ele); a grade com todos os icones e as cores fica em "Trocar", para quem quiser outro.
 */
export function ProgramFormModal({ program, onClose, onSaved }: ProgramFormModalProps) {
  const [name, setName] = useState(program?.name ?? '');
  const [icon, setIcon] = useState(program?.icon ?? DEFAULT_PROGRAM_ICON);
  const [color, setColor] = useState(program?.color ?? DEFAULT_PROGRAM_COLOR);
  // Escolhidos a mao (ou ja gravados): o nome deixa de mexer neles.
  const [iconChosen, setIconChosen] = useState(Boolean(program));
  const [colorChosen, setColorChosen] = useState(Boolean(program));
  const [picking, setPicking] = useState(false);
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
  const lookHint = !iconChosen
    ? name.trim()
      ? 'Escolhido pelo nome do programa.'
      : 'Escolhido pelo nome, conforme você digita.'
    : 'Aparece na lista de programas, nos projetos e no mapa.';

  return (
    <Modal
      guardChanges
      title={program ? 'Editar programa' : 'Novo programa'}
      subtitle="Programas agrupam projetos, como os banheiros ou as hortas. Um programa pode ter um projeto só."
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
            onChange={(event) => changeName(event.target.value)}
          />
        </Field>

        <Field label="Ícone e cor">
          <div className="program-look">
            <ProgramMark icon={icon} color={color} size={40} />
            <div className="program-look__text">
              <strong>{programIconLabel(icon)}</strong>
              <span className="field__hint">{lookHint}</span>
            </div>
            <Button small aria-expanded={picking} onClick={() => setPicking((current) => !current)}>
              {picking ? 'Pronto' : 'Trocar'}
            </Button>
          </div>

          {picking ? (
            <div className="program-look__choices">
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
                    onClick={() => chooseIcon(item.key)}
                  >
                    <ProgramIcon icon={item.key} size={20} />
                  </button>
                ))}
              </div>
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
                    onClick={() => {
                      setColor(item.key);
                      setColorChosen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </Field>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
