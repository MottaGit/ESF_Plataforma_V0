/*
 * Uso sem internet (consulta). No build, o vite.config.ts gera o /sw.js a partir deste arquivo, trocando __VERSION__
 * e __SHELL__ (a lista de arquivos do app). So roda no build de producao; no `npm run dev` nao ha service worker.
 *
 * - App (HTML, JS, CSS, fonte, icones): guardado inteiro no primeiro acesso. A pagina vem da rede primeiro (assim uma
 *   versao nova aparece no proximo acesso) e, sem internet ou com a rede lenta, da copia guardada.
 * - Dados (GET /api/... em JSON): da rede; cada resposta fica guardada. Sem internet, volta a ultima copia, marcada com
 *   o cabecalho X-Esf-Offline (o app mostra a faixa "Sem internet").
 * - Fotos e arquivos (/uploads/...): o nome nunca muda, entao a copia guardada vale para sempre.
 * - Alteracoes (POST, PUT, DELETE) nao passam por aqui: sem internet elas falham e o app avisa.
 *
 * Os dados e as fotos sao de quem esta logado: o app apaga as duas copias ao sair e ao entrar (offline.ts).
 * Para desligar tudo numa emergencia, publique um sw.js com so isto:
 *   self.addEventListener('install', () => self.skipWaiting());
 *   self.addEventListener('activate', () => self.registration.unregister());
 */

const VERSION = '__VERSION__';
const SHELL = __SHELL__;

const SHELL_CACHE = `esf-shell-${VERSION}`;
const DATA_CACHE = 'esf-data-v1';
const FILES_CACHE = 'esf-files-v1';
const DATA_LIMIT = 300;
const FILES_LIMIT = 200;

/** Rede lenta: depois disso a pagina abre com a copia guardada. */
const PAGE_TIMEOUT_MS = 4000;
/** Dados: depois disso, se ha copia guardada, ela aparece (a resposta da rede, quando chegar, atualiza a copia). */
const DATA_TIMEOUT_MS = 8000;

/**
 * Respostas que nao vale guardar: a busca (cada termo seria uma copia), o que e de uso unico e a situacao das tarefas
 * em segundo plano (uma copia velha deixaria a tela esperando um relatorio que ja ficou pronto).
 */
const NOT_KEPT = [/^\/api\/search/, /^\/api\/access\//, /^\/api\/jobs/];

/** Marca, dentro de cada copia do app, quando ela foi instalada (para saber qual e a anterior). */
const INSTALLED_AT = '/__esf-installed';

// A versao nova assume assim que termina de guardar os arquivos: sem internet, o app abre ja na versao nova, que e a
// que conhece o formato dos dados guardados mais recentes.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
      await cache.put(INSTALLED_AT, new Response(String(Date.now())));
      await self.skipWaiting();
    })()
  );
});

// Mantem a copia da versao anterior: uma aba que ficou aberta com ela ainda acha os arquivos dela (o editor de texto
// e o mapa carregam sob demanda). As mais antigas que isso saem.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const others = (await caches.keys()).filter((name) => name.startsWith('esf-shell-') && name !== SHELL_CACHE);
      const dated = await Promise.all(
        others.map(async (name) => {
          const mark = await (await caches.open(name)).match(INSTALLED_AT);
          return { name, at: mark ? Number(await mark.text()) : 0 };
        })
      );
      dated.sort((a, b) => b.at - a.at);
      await Promise.all(dated.slice(1).map(({ name }) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Outros sites (mapa, por exemplo) seguem direto.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) event.respondWith(data(request, url));
  else if (url.pathname.startsWith('/uploads/')) event.respondWith(file(request));
  else if (request.mode === 'navigate') event.respondWith(page(request));
  else event.respondWith(appFile(request, url));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function page(request) {
  const cached = await (await caches.open(SHELL_CACHE)).match('/index.html');
  // O aparelho ja sabe que esta sem internet: nem tenta a rede.
  if (cached && !self.navigator.onLine) return cached;
  try {
    const response = await Promise.race([fetch(request), timeout(PAGE_TIMEOUT_MS)]);
    if (response.status < 500) return response;
  } catch {
    // sem internet ou rede lenta: copia guardada
  }
  return cached ?? fetch(request);
}

async function data(request, url) {
  const keep = !NOT_KEPT.some((pattern) => pattern.test(url.pathname));
  const cache = await caches.open(DATA_CACHE);
  const cached = keep ? await cache.match(request.url, { ignoreVary: true }) : undefined;
  if (cached && !self.navigator.onLine) return markOffline(cached);

  const network = fetch(request).then(async (response) => {
    const type = response.headers.get('Content-Type') ?? '';
    if (keep && response.ok && type.includes('application/json')) {
      await cache.put(request.url, response.clone());
      void trim(DATA_CACHE, DATA_LIMIT);
    }
    return response;
  });

  try {
    if (!cached) return await network;
    return await Promise.race([network, timeout(DATA_TIMEOUT_MS)]);
  } catch {
    // Rede lenta: a resposta ainda pode chegar e atualizar a copia; aqui ninguem espera por ela.
    network.catch(() => undefined);
    if (cached) return markOffline(cached);
    return offline(
      keep
        ? 'Sem internet, e esta informação ainda não foi aberta neste aparelho com internet.'
        : 'Sem internet. A busca precisa de conexão.'
    );
  }
}

async function file(request) {
  const cache = await caches.open(FILES_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    void trim(FILES_CACHE, FILES_LIMIT);
  }
  return response;
}

// ignoreVary: o servidor pode responder com "Vary: Origin", e os scripts carregados sob demanda (editor de texto,
// mapa) pedem com Origin, diferente da copia guardada na instalacao. Sem isso, eles nao abrem sem internet.
async function appFile(request, url) {
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  // Arquivos com hash no nome (/assets/...) nunca mudam: guarda os que vierem depois (versao nova antes de assumir).
  if (response.ok && url.pathname.startsWith('/assets/')) {
    await (await caches.open(SHELL_CACHE)).put(request, response.clone());
  }
  return response;
}

/** Copia guardada, com o aviso de que nao veio da rede. */
async function markOffline(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Esf-Offline', '1');
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

function offline(message) {
  return new Response(JSON.stringify({ message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Esf-Offline': '1' }
  });
}

/** Mantem so as ultimas copias (cada gravacao vai para o fim da fila). */
async function trim(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
