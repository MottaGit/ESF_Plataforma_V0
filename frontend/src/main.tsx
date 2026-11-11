import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './offline/offline';
import './styles/globals.css';

registerServiceWorker();

// As telas carregam sob demanda (App.tsx). Depois de um deploy, uma aba aberta com a versao anterior pode pedir o
// arquivo de uma tela que nao existe mais: recarrega para pegar a versao nova (no maximo uma vez por minuto, para nao
// entrar em ciclo se o problema for outro).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'esf.recarregou-versao-nova';
  try {
    if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado no index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
