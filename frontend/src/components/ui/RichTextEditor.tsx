import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { TextInput } from './Field';
import { IconLink, IconListBullet, IconListOrdered } from './Icons';

export interface RichTextEditorProps {
  /** HTML atual (vazio para comecar sem texto). */
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  onChange: (html: string, plainText: string) => void;
}

/**
 * Editor de texto com formatacao basica: negrito, italico, sublinhado, listas e links.
 * Carregado sob demanda (ver RichTextField) para nao pesar a abertura do app.
 */
export default function RichTextEditor({ value, placeholder, ariaLabel, autoFocus, onChange }: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // So o que a barra oferece: sem titulos, citacoes, codigo, linha horizontal ou tachado.
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        // Sem o paragrafo vazio que o editor acrescenta sozinho no fim do texto.
        trailingNode: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' })
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'rich-editor__content rich-text',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {})
      }
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getHTML(), current.getText())
  });

  // Depois de publicar, o formulario zera o valor: o editor acompanha.
  useEffect(() => {
    if (editor && value === '' && !editor.isEmpty) editor.commands.clearContent();
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      underline: current?.isActive('underline') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      link: current?.isActive('link') ?? false
    })
  });

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    setLinkUrl('');
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;

    const raw = linkUrl.trim();
    if (raw) {
      const href = /^(https?:|mailto:)/i.test(raw) ? raw : `https://${raw}`;
      if (editor.state.selection.empty) {
        // Sem texto selecionado: insere o proprio endereco como link.
        editor
          .chain()
          .focus()
          .insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      }
    }
    setLinkOpen(false);
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Formatação do texto">
        <ToolButton editor={editor} label="Negrito (Ctrl+B)" active={active?.bold} run={(e) => e.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolButton>
        <ToolButton editor={editor} label="Itálico (Ctrl+I)" active={active?.italic} run={(e) => e.chain().focus().toggleItalic().run()}>
          <em style={{ fontFamily: 'Georgia, serif' }}>I</em>
        </ToolButton>
        <ToolButton
          editor={editor}
          label="Sublinhado (Ctrl+U)"
          active={active?.underline}
          run={(e) => e.chain().focus().toggleUnderline().run()}
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolButton>
        <span className="rich-editor__sep" aria-hidden="true" />
        <ToolButton
          editor={editor}
          label="Lista com marcadores"
          active={active?.bulletList}
          run={(e) => e.chain().focus().toggleBulletList().run()}
        >
          <IconListBullet size={16} />
        </ToolButton>
        <ToolButton
          editor={editor}
          label="Lista numerada"
          active={active?.orderedList}
          run={(e) => e.chain().focus().toggleOrderedList().run()}
        >
          <IconListOrdered size={16} />
        </ToolButton>
        <span className="rich-editor__sep" aria-hidden="true" />
        <ToolButton editor={editor} label={active?.link ? 'Remover link' : 'Inserir link'} active={active?.link} run={toggleLink}>
          <IconLink size={16} />
        </ToolButton>
      </div>

      {/* Bloco comum, nao <form>: o editor fica dentro do formulario de publicacao, e um formulario
          aninhado faria o navegador enviar a pagina ao apertar Enter ou "Aplicar". */}
      {linkOpen ? (
        <div className="rich-editor__link">
          <TextInput
            autoFocus
            value={linkUrl}
            placeholder="Cole o endereço (ex.: drive.google.com/...)"
            aria-label="Endereço do link"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              } else if (event.key === 'Escape') {
                setLinkOpen(false);
              }
            }}
          />
          <Button small variant="primary" onClick={applyLink}>
            Aplicar
          </Button>
          <Button small onClick={() => setLinkOpen(false)}>
            Cancelar
          </Button>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolButtonProps {
  editor: Editor | null;
  label: string;
  active?: boolean;
  run: (editor: Editor) => void;
  children: ReactNode;
}

function ToolButton({ editor, label, active, run, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`rich-editor__btn${active ? ' rich-editor__btn--active' : ''}`}
      aria-label={label}
      aria-pressed={Boolean(active)}
      title={label}
      disabled={!editor}
      // Mantem a selecao do texto ao clicar no botao.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => editor && run(editor)}
    >
      {children}
    </button>
  );
}
