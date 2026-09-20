import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A API roda em http://localhost:5080 no ambiente de desenvolvimento.
// O proxy evita CORS e mantem as URLs relativas ("/api/...") no codigo do frontend.
const API_TARGET = 'http://localhost:5080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true }
    }
  }
});
