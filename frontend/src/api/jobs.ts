import type { BackgroundJob, BackgroundJobKind } from '../types/api';
import { ApiError, http } from './client';

/** De quanto em quanto tempo a tela pergunta pela tarefa. */
const POLL_MS = 1500;

/** Falhas de conexão seguidas (cerca de 1 minuto) antes de desistir de esperar. */
const MAX_CONNECTION_FAILURES = 40;

/** Tarefas em segundo plano (relatório, planilha): só quem pediu vê e baixa. */
export const jobsApi = {
  get: (id: string) => http.request<BackgroundJob>(`/api/jobs/${id}`),
  /** As dos últimos 7 dias, as mais novas primeiro. */
  list: (kinds: BackgroundJobKind[]) =>
    http.request<BackgroundJob[]>(`/api/jobs${kinds.length ? `?${kinds.map((kind) => `kind=${kind}`).join('&')}` : ''}`),
  download: (job: BackgroundJob) => http.download(`/api/jobs/${job.id}/download`, undefined, job.fileName ?? 'arquivo')
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Sem internet (ou servidor reiniciando) no meio da espera: vale tentar de novo. */
const transient = (err: unknown) => err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 503);

/**
 * Espera a tarefa terminar, perguntando de tempos em tempos. Continua mesmo se a tela que pediu for fechada (o
 * download acontece do mesmo jeito). Se falhar, lança ApiError com a explicação do servidor.
 */
export async function waitForJob(job: BackgroundJob, onProgress?: (job: BackgroundJob) => void): Promise<BackgroundJob> {
  let current = job;
  let failures = 0;
  onProgress?.(current);
  while (current.status === 'Queued' || current.status === 'Running') {
    await wait(POLL_MS);
    try {
      current = await jobsApi.get(current.id);
      failures = 0;
    } catch (err) {
      if (transient(err) && ++failures < MAX_CONNECTION_FAILURES) continue;
      throw err;
    }
    onProgress?.(current);
  }
  if (current.status === 'Failed') throw new ApiError(current.error ?? 'Não foi possível concluir.', 500);
  return current;
}

/** Pede a tarefa, espera ficar pronta e baixa o arquivo. Devolve o nome do arquivo. */
export async function runFileJob(start: () => Promise<BackgroundJob>, onProgress?: (job: BackgroundJob) => void) {
  const done = await waitForJob(await start(), onProgress);
  return jobsApi.download(done);
}

/** Texto curto da situação, para o botão ou a lista ("Na fila (2 na frente)", "Gerando…"). */
export function jobStatusText(job: BackgroundJob) {
  if (job.status === 'Queued') return job.ahead ? `Na fila (${job.ahead} na frente)` : 'Na fila';
  if (job.status === 'Running') return 'Gerando…';
  if (job.status === 'Failed') return 'Não foi gerado';
  return 'Pronto';
}
