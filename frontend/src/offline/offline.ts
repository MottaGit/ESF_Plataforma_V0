/**
 * Uso sem internet (consulta): registro do service worker (service-worker.js, gerado como /sw.js no build), limpeza
 * das copias guardadas e o aviso de que a tela esta mostrando dados guardados.
 */

/** Copias com dados de quem esta logado (mesmos nomes do service-worker.js). */
const PRIVATE_CACHES = ['esf-data-v1', 'esf-files-v1'];

/** Disparado a cada resposta da API: detail = true quando ela veio da copia guardada (sem internet). */
const CONNECTION_EVENT = 'esf:connection';

/** Chaves ja guardadas nesta sessao por keepForOffline. */
const prefetched = new Set<string>();

/** So no build de producao: no `npm run dev` o app sempre busca tudo do servidor. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Quem so abre a pagina publica de um programa (parceiro, financiador) nao precisa guardar o app inteiro.
  if (window.location.pathname.startsWith('/publico/')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

/** Apaga os dados e as fotos guardados (ao sair e ao entrar: o aparelho pode ser de outra pessoa). */
export async function clearOfflineData() {
  prefetched.clear();
  if (!('caches' in window)) return;
  try {
    await Promise.all(PRIVATE_CACHES.map((name) => caches.delete(name)));
  } catch {
    // Sem acesso ao armazenamento (navegacao privada, por exemplo): nada guardado.
  }
}

export function reportConnection(fromCache: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(CONNECTION_EVENT, { detail: fromCache }));
}

export function onConnection(handler: (fromCache: boolean) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<boolean>).detail);
  window.addEventListener(CONNECTION_EVENT, listener);
  return () => window.removeEventListener(CONNECTION_EVENT, listener);
}

/**
 * Deixa guardados, para consultar em campo, dados de telas que a pessoa ainda nao abriu (ex.: os projetos dela): basta
 * buscar com internet que o service worker guarda a resposta. So com o service worker ativo; cada chave uma vez por
 * sessao.
 */
export function keepForOffline(key: string, load: () => Promise<unknown>) {
  if (!navigator.onLine || !navigator.serviceWorker?.controller || prefetched.has(key)) return;
  prefetched.add(key);
  load().catch(() => prefetched.delete(key));
}
