import { useMemo, useState, type FormEvent } from 'react';
import { todayInputValue } from '../../utils/format';
import { periodName, periodShortcuts, type PeriodShortcut } from '../../utils/periods';
import { Button } from './Button';
import { Field, TextInput } from './Field';
import { IconCalendar, IconCheck, IconChevronDown } from './Icons';
import { Modal } from './Modal';
import { usePopover } from './usePopover';

interface PeriodPickerProps {
  /** aaaa-mm-dd */
  from: string;
  to: string;
  /** Personalizado "sem data final" (vai ate hoje): mostra as datas e reabre com a caixinha marcada. */
  openEnded?: boolean;
  onShortcut: (shortcut: PeriodShortcut) => void;
  /** Personalizado; to null: sem data final (ate hoje). */
  onCustom: (from: string, to: string | null) => void;
  /** Para leitores de tela, antes do periodo ("Período de referência"). */
  label?: string;
}

/**
 * Periodo (relatorios e painel nacional): o calendario com o periodo escolhido ao lado ("30 dias", "11/04/2026 –
 * 12/11/2026"). Tocar abre os atalhos (ultimos 30 dias, 3, 6 e 12 meses) e, por ultimo, Personalizado: uma janela
 * com a data inicial e a final (ou "Sem data final", ate hoje).
 */
export function PeriodPicker({ from, to, openEnded = false, onShortcut, onCustom, label = 'Período' }: PeriodPickerProps) {
  const { open, setOpen, ref } = usePopover();
  const [customizing, setCustomizing] = useState(false);
  const shortcuts = useMemo(() => periodShortcuts(), []);
  const active = openEnded ? null : shortcuts.find((item) => item.from === from && item.to === to) ?? null;
  const name = periodName(from, to, openEnded);

  return (
    <div className="period-picker" ref={ref}>
      <button
        type="button"
        className="period-picker__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${name}`}
        onClick={() => setOpen((current) => !current)}
      >
        <IconCalendar size={16} />
        <span className="period-picker__name num">{name}</span>
        <IconChevronDown size={14} />
      </button>

      {open ? (
        <div className="menu__list period-picker__list" role="menu">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              role="menuitemradio"
              aria-checked={active?.key === shortcut.key}
              className="menu__item period-picker__item"
              onClick={() => {
                setOpen(false);
                onShortcut(shortcut);
              }}
            >
              <span className="period-picker__check">{active?.key === shortcut.key ? <IconCheck size={14} /> : null}</span>
              {shortcut.label}
              <span className="period-picker__hint">{shortcut.hint}</span>
            </button>
          ))}
          <div className="period-picker__divider" role="separator" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!active}
            className="menu__item period-picker__item"
            onClick={() => {
              setOpen(false);
              setCustomizing(true);
            }}
          >
            <span className="period-picker__check">{!active ? <IconCheck size={14} /> : null}</span>
            <IconCalendar size={14} />
            Personalizado
          </button>
        </div>
      ) : null}

      {customizing ? (
        <CustomPeriodDialog
          from={from}
          to={to}
          openEnded={openEnded}
          onClose={() => setCustomizing(false)}
          onApply={(nextFrom, nextTo) => {
            setCustomizing(false);
            onCustom(nextFrom, nextTo);
          }}
        />
      ) : null}
    </div>
  );
}

interface CustomPeriodDialogProps {
  from: string;
  to: string;
  openEnded: boolean;
  onClose: () => void;
  onApply: (from: string, to: string | null) => void;
}

/** Datas do periodo personalizado: digitadas ou escolhidas no calendario do proprio campo. */
function CustomPeriodDialog({ from, to, openEnded, onClose, onApply }: CustomPeriodDialogProps) {
  const today = todayInputValue();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to || today);
  // Comeca marcado quando o periodo ja ia ate hoje (um atalho, ou personalizado sem data final).
  const [noEnd, setNoEnd] = useState(openEnded || to === today);
  const finalDate = noEnd ? today : end;

  const error = !start
    ? 'Escolha a data inicial.'
    : !finalDate
      ? 'Escolha a data final ou marque "Sem data final".'
      : finalDate < start
        ? 'A data final não pode ser antes da inicial.'
        : null;

  function apply(event?: FormEvent) {
    event?.preventDefault();
    if (!error) onApply(start, noEnd ? null : end);
  }

  return (
    <Modal
      title="Período personalizado"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={Boolean(error)} onClick={() => apply()}>
            Aplicar
          </Button>
        </>
      }
    >
      <form className="period-dialog" onSubmit={apply}>
        <Field label="Data inicial" htmlFor="period-from">
          <TextInput id="period-from" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label="Data final" htmlFor="period-to" error={start ? error ?? undefined : undefined}>
          <TextInput
            id="period-to"
            type="date"
            value={finalDate}
            disabled={noEnd}
            invalid={Boolean(start && error)}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={noEnd} onChange={(event) => setNoEnd(event.target.checked)} />
          Sem data final (vai até hoje)
        </label>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
