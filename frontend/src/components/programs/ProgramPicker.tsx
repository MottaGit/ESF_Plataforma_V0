import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Program } from '../../types/api';
import { IconChevronDown, IconPlus, IconProjects, IconSearch } from '../ui/Icons';
import { usePopover } from '../ui/usePopover';
import { ProgramMark } from './ProgramMark';

interface ProgramPickerProps {
  /** Ativos e arquivados: os arquivados ficam num grupo proprio, embaixo. */
  programs: Program[];
  /** '' = todos os programas. */
  selectedId: string;
  onSelect: (programId: string | null) => void;
  /** So para a coordenacao: "Novo programa" no rodape da lista. */
  onCreate?: () => void;
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const byName = (a: Program, b: Program) => a.name.localeCompare(b.name, 'pt-BR');

/** Busca so aparece quando a lista ja nao cabe de uma olhada. */
const SEARCH_FROM = 8;

/**
 * Escolha do programa na tela Projetos: um botao com o icone e o nome do programa escolhido que abre a lista (com
 * busca, os arquivados agrupados embaixo e, para a coordenacao, "Novo programa"). Substitui as abas, que nao cabiam
 * quando o nucleo tem dezenas de programas.
 */
export function ProgramPicker({ programs, selectedId, onSelect, onCreate }: ProgramPickerProps) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = programs.find((program) => program.id === selectedId) ?? null;
  const withSearch = programs.length >= SEARCH_FROM;

  const { active, archived } = useMemo(() => {
    const term = normalize(query.trim());
    const matches = programs.filter((program) => !term || normalize(program.name).includes(term));
    return {
      active: matches.filter((program) => program.status === 'Ativo').sort(byName),
      archived: matches.filter((program) => program.status !== 'Ativo').sort(byName)
    };
  }, [programs, query]);

  // Ordem das opcoes para o teclado: "Todos" (sem busca), ativos e arquivados.
  const options = useMemo<Array<Program | null>>(
    () => [...(query.trim() ? [] : [null]), ...active, ...archived],
    [query, active, archived]
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const current = selected ? [null, ...active, ...archived].indexOf(selected) : 0;
    setActiveIndex(Math.max(0, current));
    // No celular, focar a busca abriria o teclado por cima da lista: la ela so recebe foco quando tocada.
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    (withSearch && !touch ? searchRef.current : listRef.current)?.focus();
    // So ao abrir: depois, quem move a opcao ativa e o teclado.
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function choose(program: Program | null) {
    setOpen(false);
    onSelect(program?.id ?? null);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + step)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (options.length > 0) choose(options[Math.min(activeIndex, options.length - 1)]);
    } else if (event.key === 'Escape') {
      triggerRef.current?.focus();
    }
  }

  const optionId = (program: Program | null) => `program-option-${program?.id ?? 'todos'}`;
  const activeOption = options[Math.min(activeIndex, options.length - 1)];

  function renderOption(program: Program | null) {
    const index = options.indexOf(program);
    const isSelected = (program?.id ?? '') === selectedId;
    return (
      <li
        key={optionId(program)}
        id={optionId(program)}
        role="option"
        aria-selected={isSelected}
        data-active={index === activeIndex}
        className={`program-picker__option${program && program.status !== 'Ativo' ? ' program-picker__option--archived' : ''}`}
        onMouseMove={() => setActiveIndex(index)}
        onClick={() => choose(program)}
      >
        {program ? (
          <ProgramMark icon={program.icon} color={program.color} size={28} />
        ) : (
          <span className="program-picker__all" aria-hidden="true">
            <IconProjects size={15} />
          </span>
        )}
        <span className="program-picker__name">{program ? program.name : 'Todos os programas'}</span>
        {program ? <span className="program-picker__count num">{program.projectsCount}</span> : null}
      </li>
    );
  }

  return (
    <div className="program-picker" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="program-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <ProgramMark icon={selected.icon} color={selected.color} size={30} />
        ) : (
          <span className="program-picker__all program-picker__all--large" aria-hidden="true">
            <IconProjects size={16} />
          </span>
        )}
        <span className="program-picker__label">
          <span className="program-picker__caption">Programa</span>
          <span className="program-picker__value">{selected ? selected.name : 'Todos os programas'}</span>
        </span>
        <IconChevronDown size={16} className="program-picker__chevron" />
      </button>

      {open ? (
        <div className="program-picker__panel">
          {withSearch ? (
            <span className="search program-picker__search">
              <IconSearch className="search__icon" />
              <input
                ref={searchRef}
                className="input"
                placeholder="Buscar programa"
                value={query}
                role="combobox"
                aria-expanded="true"
                aria-controls="program-picker-list"
                aria-activedescendant={activeOption !== undefined ? optionId(activeOption) : undefined}
                aria-label="Buscar programa"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </span>
          ) : null}

          <ul
            ref={listRef}
            id="program-picker-list"
            className="program-picker__list"
            role="listbox"
            aria-label="Programas"
            tabIndex={withSearch ? -1 : 0}
            aria-activedescendant={!withSearch && activeOption !== undefined ? optionId(activeOption) : undefined}
            onKeyDown={withSearch ? undefined : handleKeyDown}
          >
            {query.trim() ? null : renderOption(null)}
            {active.map((program) => renderOption(program))}
            {archived.length > 0 ? (
              <li role="presentation" className="program-picker__group">
                Arquivados
              </li>
            ) : null}
            {archived.map((program) => renderOption(program))}
            {options.length === 0 ? (
              <li role="presentation" className="program-picker__empty">
                Nenhum programa com esse nome.
              </li>
            ) : null}
          </ul>

          {onCreate ? (
            <button
              type="button"
              className="program-picker__create"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
            >
              <IconPlus size={15} />
              Novo programa
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
