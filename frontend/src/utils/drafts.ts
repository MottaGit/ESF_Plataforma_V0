/**
 * Rascunhos guardados no aparelho (localStorage), para o texto nao se perder ao trocar de tela, recarregar, perder a
 * sessao ou fechar o navegador no meio de um registro. Cada rascunho e da pessoa logada (a chave leva o id dela) e
 * todos sao apagados quando alguem usa "Sair" (o aparelho pode ser compartilhado). Fotos escolhidas nao entram.
 */

const PREFIX = 'esf.rascunho.';
/** Rascunho esquecido ha mais tempo que isso e descartado. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface ProgressDraft {
  html: string;
  hours: string;
  /** Dia em que aconteceu, quando nao e o de hoje (aaaa-mm-dd). */
  day?: string;
  savedAt: number;
}

export function progressDraftKey(userId: string, projectId: string) {
  return `${PREFIX}registro.${userId}.${projectId}`;
}

export function loadDraft(key: string): ProgressDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ProgressDraft;
    if (typeof draft?.html !== 'string' || Date.now() - draft.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      html: draft.html,
      hours: typeof draft.hours === 'string' ? draft.hours : '',
      day: typeof draft.day === 'string' ? draft.day : undefined,
      savedAt: draft.savedAt
    };
  } catch {
    return null;
  }
}

export function saveDraft(key: string, html: string, hours: string, day?: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ html, hours, day, savedAt: Date.now() } satisfies ProgressDraft));
  } catch {
    // Sem espaco ou sem acesso ao armazenamento (navegacao privada): segue sem rascunho.
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // idem
  }
}

/** Apaga todos os rascunhos do aparelho (ao sair). */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // idem
  }
}
