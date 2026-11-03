import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconClose, IconFilter } from './Icons';
import { usePopover } from './usePopover';

interface FilterSheetProps {
  /** Quantos filtros estao ligados: aparece no botao ("Filtros (2)"). */
  active: number;
  /** Ha algo para limpar (pode incluir a busca, que no celular fica dentro do painel). */
  canClear: boolean;
  onClear: () => void;
  /** Botao do rodape, que fecha o painel (ex.: "Ver 7 tarefas"). */
  resultLabel: string;
  /** Campos com rotulo (Field). */
  children: ReactNode;
}

/**
 * Botao "Filtros" que abre os campos rotulados: no computador, um painel pequeno preso ao botao; no celular, uma folha
 * que sobe de baixo, com o fundo escurecido. Os filtros valem na hora; o rodape limpa tudo ou fecha mostrando quantos
 * resultados ficaram.
 */
export function FilterSheet({ active, canClear, onClear, resultLabel, children }: FilterSheetProps) {
  const { open, setOpen, ref } = usePopover();

  return (
    <div className="filter-sheet" ref={ref}>
      <button
        type="button"
        className={`btn filter-sheet__toggle${active > 0 ? ' filter-sheet__toggle--on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <IconFilter size={15} />
        Filtros
        {active > 0 ? <span className="num">({active})</span> : null}
      </button>

      {open ? (
        <>
          <div className="filter-sheet__backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="filter-sheet__panel" role="dialog" aria-label="Filtros">
            <div className="filter-sheet__head">
              <strong>Filtros</strong>
              <Button small variant="ghost" icon={<IconClose size={16} />} aria-label="Fechar" onClick={() => setOpen(false)} />
            </div>
            <div className="filter-sheet__fields">{children}</div>
            <div className="filter-sheet__foot">
              {canClear ? (
                <button type="button" className="link-button" onClick={onClear}>
                  Limpar filtros
                </button>
              ) : (
                <span />
              )}
              <Button variant="primary" small onClick={() => setOpen(false)}>
                {resultLabel}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
