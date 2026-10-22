import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight } from './Icons';

interface ScrollTabsProps {
  children: ReactNode;
  /** Aba aberta: ao mudar, ela e trazida para a parte visivel da barra. */
  activeKey?: string;
}

/**
 * Barra de abas que rola para o lado quando nao cabe (no celular). Na borda onde ha mais abas aparece uma seta com
 * degrade, para ficar claro que existe mais coisa ali; tocar na seta rola a barra.
 */
export function ScrollTabs({ children, activeKey }: ScrollTabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  function update() {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // So rola a barra (nunca a pagina): a aba aberta fica centralizada quando possivel.
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('.tab--active');
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollLeft = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
    update();
  }, [activeKey]);

  function scrollBy(direction: 1 | -1) {
    ref.current?.scrollBy({ left: direction * 160, behavior: 'smooth' });
  }

  return (
    <div className="tabs-scroll">
      <div className="tabs" ref={ref} onScroll={update}>
        {children}
      </div>
      {edges.left ? (
        <button
          type="button"
          className="tabs-scroll__arrow tabs-scroll__arrow--left"
          aria-label="Ver abas anteriores"
          onClick={() => scrollBy(-1)}
        >
          <IconChevronLeft size={16} />
        </button>
      ) : null}
      {edges.right ? (
        <button
          type="button"
          className="tabs-scroll__arrow tabs-scroll__arrow--right"
          aria-label="Ver mais abas"
          onClick={() => scrollBy(1)}
        >
          <IconChevronRight size={16} />
        </button>
      ) : null}
    </div>
  );
}
