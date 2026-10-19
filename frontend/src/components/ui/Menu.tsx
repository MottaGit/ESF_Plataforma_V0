import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconMore } from './Icons';
import { usePopover } from './usePopover';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

/** Botao "..." que abre uma lista de acoes. Fecha ao escolher, clicar fora ou apertar Esc. */
export function Menu({ items, label = 'Mais ações' }: { items: MenuItem[]; label?: string }) {
  const { open, setOpen, ref } = usePopover();

  return (
    <div className="menu" ref={ref}>
      <Button
        small
        variant="ghost"
        icon={<IconMore size={16} />}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div className="menu__list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu__item${item.danger ? ' menu__item--danger' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
