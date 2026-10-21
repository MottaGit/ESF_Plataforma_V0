import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchApi } from '../../api/endpoints';
import type { SearchResults } from '../../types/api';
import { activityStatusLabel, formatDate, projectStatusLabel, sectorLabel } from '../../utils/format';
import { ProgramMark } from '../programs/ProgramMark';
import { Avatar } from '../ui/Avatar';
import { IconClose, IconComment, IconSearch } from '../ui/Icons';
import { usePopover } from '../ui/usePopover';

interface ResultItem {
  key: string;
  group: string;
  label: string;
  meta: string;
  to: string;
  icon: ReactNode;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Lista unica (para as setas do teclado), na ordem em que os grupos aparecem. */
function flatten(results: SearchResults): ResultItem[] {
  return [
    ...results.projects.map((p) => ({
      key: `p-${p.id}`,
      group: 'Projetos',
      label: p.name,
      meta: `${p.programName} · ${projectStatusLabel(p.status)}${p.isArchived ? ' · arquivado' : ''}`,
      to: `/projetos/${p.id}`,
      icon: <ProgramMark icon={p.programIcon} color={p.programColor} size={26} />
    })),
    ...results.activities.map((a) => ({
      key: `a-${a.id}`,
      group: 'Tarefas',
      label: a.title,
      meta: `${a.projectName} · ${activityStatusLabel(a.status)}`,
      to: `/projetos/${a.projectId}?aba=tarefas&tarefa=${a.id}`,
      icon: <span className="global-search__glyph">✓</span>
    })),
    ...results.volunteers.map((v) => ({
      key: `v-${v.id}`,
      group: 'Voluntários',
      label: v.name,
      meta: sectorLabel(v.sector),
      to: `/voluntarios/${v.id}`,
      icon: <Avatar name={v.name} photoUrl={v.photoUrl} size={26} />
    })),
    ...results.programs.map((g) => ({
      key: `g-${g.id}`,
      group: 'Programas',
      label: g.name,
      meta: g.isArchived ? 'Programa arquivado' : 'Programa',
      to: `/projetos?programa=${g.id}`,
      icon: <ProgramMark icon={g.icon} color={g.color} size={26} />
    })),
    ...results.updates.map((u) => ({
      key: `u-${u.id}`,
      group: 'Relatos',
      label: u.snippet,
      meta: `${u.projectName} · ${formatDate(u.createdAt)}`,
      to: `/projetos/${u.projectId}`,
      icon: (
        <span className="global-search__glyph">
          <IconComment size={14} />
        </span>
      )
    }))
  ];
}

/**
 * Busca geral do topo: projetos, atividades, voluntarios, programas e relatos ao mesmo tempo, sem diferenciar
 * acentos. Ctrl+K (⌘K no Mac) leva o cursor ate ela; no celular, a lupa abre a busca em cima da tela.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open, setOpen, ref } = usePopover();
  const input = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sequence = useRef(0);

  const items = useMemo(() => (results ? flatten(results) : []), [results]);
  const term = query.trim();

  // Ctrl+K / ⌘K em qualquer tela.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => input.current?.focus(), 0);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Trocou de tela: fecha e limpa.
  useEffect(() => {
    setOpen(false);
    setQuery('');
    setResults(null);
  }, [location.pathname, location.search, setOpen]);

  useEffect(() => {
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const current = ++sequence.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchApi
        .search(term)
        .then((found) => {
          if (current !== sequence.current) return;
          setResults(found);
          setHighlight(0);
        })
        .catch(() => current === sequence.current && setResults(null))
        .finally(() => current === sequence.current && setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  function go(item: ResultItem) {
    setOpen(false);
    input.current?.blur();
    navigate(item.to);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => (current + step + items.length) % items.length);
    } else if (event.key === 'Enter' && items[highlight]) {
      event.preventDefault();
      go(items[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
    }
  }

  const showPanel = open && term.length >= 2;
  let lastGroup = '';

  return (
    <div className={`global-search${open ? ' global-search--open' : ''}`} ref={ref}>
      <button
        type="button"
        className="icon-button global-search__toggle"
        aria-label="Buscar"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <IconSearch size={18} />
      </button>

      <div className="global-search__field">
        <IconSearch className="global-search__icon" />
        <input
          ref={input}
          className="input global-search__input"
          type="search"
          value={query}
          placeholder="Buscar projetos, tarefas, pessoas…"
          aria-label="Busca geral"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={keyDown}
        />
        <kbd className="global-search__kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        <button
          type="button"
          className="icon-button global-search__close"
          aria-label="Fechar busca"
          onClick={() => setOpen(false)}
        >
          <IconClose size={18} />
        </button>
      </div>

      {showPanel ? (
        <div className="global-search__panel" id="global-search-results" role="listbox" aria-label="Resultados da busca">
          {loading && !results ? <p className="global-search__empty">Buscando…</p> : null}
          {results && items.length === 0 ? (
            <p className="global-search__empty">Nada encontrado para "{term}".</p>
          ) : null}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {header ? <div className="global-search__group">{header}</div> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`global-search__item${index === highlight ? ' global-search__item--active' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => go(item)}
                >
                  {item.icon}
                  <span className="global-search__text">
                    <span className="global-search__label">{item.label}</span>
                    <span className="global-search__meta">{item.meta}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
