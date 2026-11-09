import { Fragment, type ReactNode } from 'react';

/** Enderecos (http, https ou www.) no meio do texto; o ponto ou a virgula no fim da frase ficam de fora. */
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/**
 * Texto puro com os enderecos (link do Drive, de um orcamento) virando links que abrem em outra aba. O resto do texto
 * continua texto (nada de HTML vindo do que a pessoa escreveu).
 */
export function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
    const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
    return (
      <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-link">
        {part}
      </a>
    );
  });
}
