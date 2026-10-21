import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { notificationsApi } from '../../api/endpoints';
import type { AppNotification } from '../../types/api';
import { UNLINKED_MESSAGE, timeAgo } from '../../utils/format';
import { Loading } from '../ui/Feedback';
import { IconBell } from '../ui/Icons';
import { usePopover } from '../ui/usePopover';

/** De quanto em quanto tempo o sininho confere se chegou aviso novo. */
const POLL_MS = 60_000;

/** Para onde o aviso leva: a propria tarefa (aberta na aba Tarefas do projeto), quando e de uma; senao, o projeto. */
export function linkFor(notification: AppNotification) {
  if (!notification.projectId) return null;
  return notification.activityId
    ? `/projetos/${notification.projectId}?aba=tarefas&tarefa=${notification.activityId}`
    : `/projetos/${notification.projectId}`;
}

/**
 * Sininho no topo da tela: mostra quantos avisos nao foram lidos e, ao clicar, a lista dos mais recentes.
 * Abrir um aviso marca como lido e leva ao projeto ou a atividade.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { open, setOpen, ref } = usePopover();

  const [unread, setUnread] = useState(0);
  const [linked, setLinked] = useState(true);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    notificationsApi
      .unread()
      .then((result) => {
        setLinked(result.linked);
        setUnread(result.count);
      })
      .catch(() => undefined);
  }, []);

  // Confere ao trocar de tela, ao voltar para a aba do navegador e a cada minuto.
  useEffect(() => {
    refreshCount();
  }, [refreshCount, location.pathname]);

  useEffect(() => {
    const timer = window.setInterval(refreshCount, POLL_MS);
    document.addEventListener('visibilitychange', refreshCount);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshCount);
    };
  }, [refreshCount]);

  // A lista e buscada de novo cada vez que o painel abre.
  useEffect(() => {
    if (!open) return;
    setError(null);
    notificationsApi
      .list()
      .then((result) => {
        setLinked(result.linked);
        setUnread(result.unreadCount);
        setItems(result.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os avisos.'));
  }, [open]);

  async function openNotification(notification: AppNotification) {
    const link = linkFor(notification);
    setOpen(false);
    if (!notification.read) {
      setItems((current) => current?.map((item) => (item.id === notification.id ? { ...item, read: true } : item)) ?? null);
      setUnread((count) => Math.max(0, count - 1));
      // Grava antes de navegar: a troca de tela reconsulta o contador e ja deve contar este como lido.
      await notificationsApi.markRead(notification.id).catch(() => undefined);
    }
    if (link) navigate(link);
  }

  function markAllRead() {
    setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
    setUnread(0);
    notificationsApi.markAllRead().catch(() => refreshCount());
  }

  const label = unread > 0 ? `Avisos (${unread} não lidos)` : 'Avisos';

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="icon-button bell__button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        <IconBell size={19} />
        {linked && unread > 0 ? <span className="bell__count num">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="bell__panel" role="dialog" aria-label="Avisos">
          <div className="bell__head">
            <strong>Notificações</strong>
            {linked && unread > 0 ? (
              <button type="button" className="link-button" onClick={markAllRead}>
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {!linked ? (
            <p className="bell__empty">{UNLINKED_MESSAGE}</p>
          ) : error ? (
            <p className="bell__empty">{error}</p>
          ) : items === null ? (
            <Loading label="Carregando avisos…" />
          ) : items.length === 0 ? (
            <p className="bell__empty">Nenhum aviso por enquanto.</p>
          ) : (
            <ul className="bell__list">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`bell__item${notification.read ? '' : ' bell__item--unread'}`}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className="bell__dot" aria-hidden="true" />
                    <span className="bell__text">
                      <span className="bell__message">{notification.message}</span>
                      <span className="bell__meta">
                        {notification.context ? `${notification.context} · ` : ''}
                        {timeAgo(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
