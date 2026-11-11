import { useCallback, useRef } from 'react';

/**
 * Para telas que buscam de novo quando um filtro (ou o id da pagina) muda: so vale a resposta do pedido mais recente.
 * Sem isso, quem troca de filtro rapido pode ficar com a lista do filtro anterior, se aquela resposta chegar por
 * ultimo.
 *
 *   const startRequest = useLatestRequest();
 *   const isCurrent = startRequest();
 *   const data = await api();
 *   if (isCurrent()) setData(data);
 */
export function useLatestRequest() {
  const latest = useRef(0);
  return useCallback(() => {
    const id = ++latest.current;
    return () => id === latest.current;
  }, []);
}
