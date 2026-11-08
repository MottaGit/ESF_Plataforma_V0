import { reportConnection } from '../offline/offline';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const TOKEN_KEY = 'esf.token';
const UNAUTHORIZED_EVENT = 'esf:unauthorized';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY)
};

export function onUnauthorized(handler: () => void) {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

/** Monta a URL completa de um arquivo servido pela API (fotos, logo). */
export function assetUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Quando true, nao dispara o logout automatico em 401 (usado no login). */
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    params.append(key, String(value));
  });

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Mensagem para quando a resposta nao traz a explicacao da API (pagina de erro do proxy, servidor reiniciando). */
function statusMessage(status: number) {
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Registro não encontrado.';
  if (status === 413) return 'O arquivo é grande demais para enviar.';
  if (status >= 500) return 'O servidor não respondeu. Tente de novo em instantes.';
  return 'Não foi possível concluir a operação.';
}

async function parseError(response: Response): Promise<ApiError> {
  let message = statusMessage(response.status);
  let fieldErrors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    // So a mensagem da propria API ({ message }); o "title" padrao do ASP.NET vem em ingles.
    if (typeof data?.message === 'string') message = data.message;
    if (data?.errors && typeof data.errors === 'object') fieldErrors = data.errors;
  } catch {
    // sem JSON: fica a mensagem do status
  }

  return new ApiError(message, response.status, fieldErrors);
}

/** Falha antes de chegar resposta: sem internet ou servidor fora do ar. */
function connectionError() {
  if (!navigator.onLine) return new ApiError('Sem internet. Conecte-se e tente de novo.', 0);
  return new ApiError('Não foi possível falar com o servidor. Confira a internet e tente de novo em instantes.', 0);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, query, skipAuthRedirect } = options;
  const headers: Record<string, string> = {};
  const token = tokenStore.get();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined)
    });
  } catch {
    throw connectionError();
  }

  // Sem internet, o service worker devolve a ultima copia guardada (ou um 503 explicando) com este cabecalho.
  reportConnection(response.headers.get('X-Esf-Offline') === '1');

  if (response.status === 401 && !skipAuthRedirect) {
    tokenStore.clear();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) return (await response.json()) as T;

  return (await response.text()) as unknown as T;
}

/**
 * Faz o download de um arquivo da API com o login junto (relatorio em PDF, documentos assinados). Com body,
 * usa POST; sem body, GET.
 */
async function download(path: string, body: unknown, fallbackName: string) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response =
      body === undefined
        ? await fetch(buildUrl(path), { headers })
        : await fetch(buildUrl(path), {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
  } catch {
    throw connectionError();
  }

  if (!response.ok) throw await parseError(response);

  // filename* traz o nome com acentos (UTF-8); filename e a versao simples.
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  const fileName = encoded ? decodeURIComponent(encoded[1]) : (plain?.[1] ?? fallbackName);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return fileName;
}

export const http = { request, download };
