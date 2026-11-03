import { useState, type ReactNode } from 'react';

interface CollapsibleFiltersProps {
  /** Quantos filtros estao ligados: aparece no botao ("Filtros (2)"). */
  active: number;
  children: ReactNode;
  /** Filtros que ficam no botao tambem no computador (a busca, em children, continua a mostra). */
  extra?: ReactNode;
  /** Quantos dos filtros de extra estao ligados (o numero do botao no computador). */
  extraActive?: number;
}

/**
 * Busca e filtros de uma barra de ferramentas. No computador ficam a mostra, na propria barra; no celular ficam
 * recolhidos no botao "Filtros", que abre o painel embaixo da barra. Com extra, esses filtros ficam no botao tambem
 * no computador (abrem numa linha embaixo da barra) e so a busca fica a mostra.
 */
export function CollapsibleFilters({ active, children, extra, extraActive = 0 }: CollapsibleFiltersProps) {
  const [open, setOpen] = useState(false);
  const split = extra !== undefined;

  return (
    <>
      <button
        type="button"
        className={`btn filters-toggle${split ? ' filters-toggle--split' : ''}${active > 0 ? ' filters-toggle--on' : ''}${extraActive > 0 ? ' filters-toggle--on-desktop' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Filtros
        {active > 0 ? <span className="filters-toggle__count filters-toggle__count--mobile"> ({active})</span> : null}
        {extraActive > 0 ? <span className="filters-toggle__count filters-toggle__count--desktop"> ({extraActive})</span> : null}
      </button>
      <div className={`filters-panel${split ? ' filters-panel--split' : ''}${open ? ' filters-panel--open' : ''}`}>
        {children}
        {split ? <div className="filters-extra">{extra}</div> : null}
      </div>
    </>
  );
}
