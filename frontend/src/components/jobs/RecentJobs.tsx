import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { jobStatusText, jobsApi } from '../../api/jobs';
import { useToast } from '../../context/ToastContext';
import type { BackgroundJob, BackgroundJobKind } from '../../types/api';
import { timeAgo } from '../../utils/format';
import { Button } from '../ui/Button';
import { IconDownload } from '../ui/Icons';

interface RecentJobsProps {
  kinds: BackgroundJobKind[];
  title: string;
  /** Nome para o que ainda não tem arquivo ("Relatório", "Planilha"). */
  fallbackName: string;
  /** Muda quando a tela pede uma tarefa nova, para a lista recarregar. */
  refreshKey: number;
}

/**
 * O que a pessoa gerou nos últimos 7 dias (relatórios, planilhas), para baixar de novo ou acompanhar depois de sair
 * da tela. Some quando não há nada. Enquanto alguma está na fila, a lista se atualiza sozinha.
 */
export function RecentJobs({ kinds, title, fallbackName, refreshKey }: RecentJobsProps) {
  const { notify, notifyError } = useToast();
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const kindsKey = kinds.join(',');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const list = await jobsApi.list(kindsKey.split(',') as BackgroundJobKind[]);
        if (cancelled) return;
        setJobs(list);
        if (list.some((job) => job.status === 'Queued' || job.status === 'Running')) timer = window.setTimeout(load, 3000);
      } catch {
        // A lista é só um atalho: sem ela, a tela segue funcionando.
      }
    };
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kindsKey, refreshKey]);

  async function download(job: BackgroundJob) {
    setDownloading(job.id);
    try {
      notify(`Arquivo baixado: ${await jobsApi.download(job)}`);
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível baixar o arquivo.');
    } finally {
      setDownloading(null);
    }
  }

  if (jobs.length === 0) return null;

  return (
    <section className="panel job-recent">
      <div className="panel__head">
        <h2>{title}</h2>
        <span className="panel__hint">guardados por 7 dias</span>
      </div>
      <ul className="job-list">
        {jobs.map((job) => (
          <li key={job.id} className="job-list__item">
            <div className="job-list__text">
              <span className="job-list__name">{job.fileName ?? fallbackName}</span>
              <span className="job-list__meta">
                {timeAgo(job.createdAt)} · {jobStatusText(job)}
                {job.status === 'Failed' && job.error ? `: ${job.error}` : ''}
              </span>
            </div>
            {job.status === 'Done' && job.fileName ? (
              <Button
                small
                icon={<IconDownload size={15} />}
                loading={downloading === job.id}
                onClick={() => void download(job)}
              >
                Baixar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
