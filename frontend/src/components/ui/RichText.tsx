import { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './RichTextEditor';

// O editor (TipTap) so e baixado quando um formulario de relato aparece na tela.
const RichTextEditor = lazy(() => import('./RichTextEditor'));

export function RichTextField(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="rich-editor">
          <div className="rich-editor__content rich-editor__content--loading">Carregando editor…</div>
        </div>
      }
    >
      <RichTextEditor {...props} />
    </Suspense>
  );
}

/**
 * Mostra um texto formatado. O HTML vem da API ja limpo (Services/RichText.cs): so paragrafos,
 * negrito, italico, sublinhado, listas e links sobrevivem; scripts e estilos sao removidos ao salvar.
 */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return <div className={`rich-text${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Texto sem formatacao de um HTML (para validar tamanho minimo). */
export function htmlToPlainText(html: string) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}
