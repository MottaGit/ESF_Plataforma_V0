import { useEffect, useState } from 'react';
import { Alert } from '../components/ui/Feedback';
import { onConnection } from './offline';

/**
 * Faixa no topo das telas quando nao ha internet (o aparelho avisa) ou quando a ultima resposta da API veio da copia
 * guardada (rede que nao responde). Some sozinha quando uma resposta volta da rede.
 */
export function OfflineBanner() {
  const [deviceOffline, setDeviceOffline] = useState(() => !navigator.onLine);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const update = () => setDeviceOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const stop = onConnection(setFromCache);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      stop();
    };
  }, []);

  if (!deviceOffline && !fromCache) return null;

  return (
    <div className="offline-banner" role="status">
      <Alert kind="warning">
        <strong>Sem internet.</strong> Você está vendo o que foi carregado da última vez que teve conexão. Para salvar
        alguma coisa, conecte-se.
      </Alert>
    </div>
  );
}
