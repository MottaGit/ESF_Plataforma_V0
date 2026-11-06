import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// A API roda em http://localhost:5080 no ambiente de desenvolvimento.
// O proxy evita CORS e mantem as URLs relativas ("/api/...") no codigo do frontend.
const API_TARGET = 'http://localhost:5080';

/** Arquivos da pasta public (icones, manifest), com o caminho de URL. */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [`/${relative('public', path).replace(/\\/g, '/')}`];
  });
}

/**
 * Uso sem internet: no build, gera o /sw.js a partir de service-worker.js com a lista de arquivos do app (guardados
 * no primeiro acesso) e uma versao que muda sempre que algum arquivo muda.
 */
function serviceWorker(): Plugin {
  return {
    name: 'esf-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const template = readFileSync('service-worker.js', 'utf8');
      const built = Object.keys(bundle).filter((name) => !name.endsWith('.map') && name !== 'index.html');
      const shell = ['/index.html', ...built.map((name) => `/${name}`), ...publicFiles()];

      const hash = createHash('sha256').update(template).update(shell.sort().join('\n'));
      const html = bundle['index.html'];
      if (html?.type === 'asset') hash.update(html.source);
      const version = hash.digest('hex').slice(0, 12);

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
          .replace('const SHELL = __SHELL__;', `const SHELL = ${JSON.stringify(shell)};`)
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
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
