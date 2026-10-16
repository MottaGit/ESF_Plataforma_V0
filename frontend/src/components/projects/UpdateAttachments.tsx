import { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '../../api/client';
import type { ProjectFile } from '../../types/api';
import { fileExtension, formatFileSize } from '../../utils/format';
import { IconClose } from '../ui/Icons';
import { Lightbox } from '../ui/Lightbox';

/** Quantas miniaturas aparecem antes do "+N". */
const MAX_THUMBS = 4;

interface UpdateAttachmentsProps {
  files: ProjectFile[];
  /** Quando informado (modo de edicao), mostra todas as miniaturas com o botao de remover. */
  onRemove?: (file: ProjectFile) => void;
}

/** Anexos de uma atualizacao: fotos em miniaturas pequenas (abrem o visualizador) e documentos em linhas. */
export function UpdateAttachments({ files, onRemove }: UpdateAttachmentsProps) {
  const [viewing, setViewing] = useState<number | null>(null);

  const images = files.filter((file) => file.isImage);
  const documents = files.filter((file) => !file.isImage);
  const visible = onRemove ? images : images.slice(0, MAX_THUMBS);
  const hiddenCount = images.length - visible.length;

  if (files.length === 0) return null;

  return (
    <div className="attachments">
      {images.length > 0 ? (
        <div className="media-strip">
          {visible.map((file, index) => (
            <div className="media-thumb" key={file.id}>
              <button
                type="button"
                className="media-thumb__open"
                aria-label={`Ver foto ${index + 1} de ${images.length}`}
                title={file.description ?? file.fileName}
                onClick={() => setViewing(index)}
              >
                <img src={assetUrl(file.url)} alt={file.description ?? file.fileName} loading="lazy" />
                {index === visible.length - 1 && hiddenCount > 0 ? (
                  <span className="media-thumb__more num">+{hiddenCount}</span>
                ) : null}
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="media-thumb__remove"
                  aria-label={`Remover ${file.fileName}`}
                  title="Remover foto"
                  onClick={() => onRemove(file)}
                >
                  <IconClose size={11} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="doc-list">
          {documents.map((file) => (
            <div className="doc-chip" key={file.id}>
              <a href={assetUrl(file.url)} target="_blank" rel="noreferrer" download={file.fileName}>
                <span className="doc-chip__ext">{fileExtension(file.fileName)}</span>
                <span className="doc-chip__name">{file.description || file.fileName}</span>
                <span className="doc-chip__size">{formatFileSize(file.sizeBytes)}</span>
              </a>
              {onRemove ? (
                <button
                  type="button"
                  className="doc-chip__remove"
                  aria-label={`Remover ${file.fileName}`}
                  title="Remover arquivo"
                  onClick={() => onRemove(file)}
                >
                  <IconClose size={11} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {viewing !== null ? (
        <Lightbox
          items={images.map((file) => ({ url: assetUrl(file.url), caption: file.description, fileName: file.fileName }))}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}

/** Previa dos arquivos escolhidos antes de publicar: miniatura para fotos, nome para documentos. */
export function StagedFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const previews = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)),
    [files]
  );

  useEffect(
    () => () => previews.forEach((url) => (url ? URL.revokeObjectURL(url) : undefined)),
    [previews]
  );

  if (files.length === 0) return null;

  return (
    <div className="media-strip" style={{ marginTop: 10 }}>
      {files.map((file, index) => (
        <div className={previews[index] ? 'media-thumb media-thumb--small' : 'doc-chip'} key={`${file.name}-${index}`}>
          {previews[index] ? (
            <img src={previews[index] ?? undefined} alt={file.name} />
          ) : (
            <span className="doc-chip__label">
              <span className="doc-chip__ext">{fileExtension(file.name)}</span>
              <span className="doc-chip__name">{file.name}</span>
            </span>
          )}
          <button
            type="button"
            className={previews[index] ? 'media-thumb__remove' : 'doc-chip__remove'}
            aria-label={`Remover ${file.name}`}
            onClick={() => onRemove(index)}
          >
            <IconClose size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
