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

async function parseError(response: Response): Promise<ApiError> {
  let message = 'Nao foi possivel concluir a operacao.';
  let fieldErrors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    if (typeof data?.message === 'string') message = data.message;
    else if (typeof data?.title === 'string') message = data.title;
    if (data?.errors && typeof data.errors === 'object') fieldErrors = data.errors;
  } catch {
    if (response.status === 401) message = 'Sessao expirada. Entre novamente.';
    if (response.status === 403) message = 'Voce nao tem permissao para esta acao.';
    if (response.status === 404) message = 'Registro nao encontrado.';
  }

  return new ApiError(message, response.status, fieldErrors);
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
    throw new ApiError('Nao foi possivel falar com o servidor. Verifique se a API esta em execucao.', 0);
  }

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

/** Faz o download de um arquivo gerado pela API (relatorio em PDF). */
async function download(path: string, body: unknown, fallbackName: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(path), { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) throw await parseError(response);

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const fileName = match?.[1] ?? fallbackName;

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
