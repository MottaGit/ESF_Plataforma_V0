import { useState, type ReactNode } from 'react';

interface CollapsibleFiltersProps {
  /** Quantos filtros estao ligados: aparece no botao ("Filtros (2)"). */
  active: number;
  children: ReactNode;
}

/**
 * Busca e filtros de uma barra de ferramentas. No computador ficam a mostra, na propria barra; no celular ficam
 * recolhidos no botao "Filtros", que abre o painel embaixo da barra.
 */
export function CollapsibleFilters({ active, children }: CollapsibleFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`btn filters-toggle${active > 0 ? ' filters-toggle--on' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Filtros{active > 0 ? ` (${active})` : ''}
      </button>
      <div className={`filters-panel${open ? ' filters-panel--open' : ''}`}>{children}</div>
    </>
  );
}
