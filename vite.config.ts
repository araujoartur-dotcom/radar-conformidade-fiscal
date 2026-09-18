import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import {defineConfig} from 'vite';

let commitHash = 'local-dev';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}

const buildTimestamp = new Date().toISOString();

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.5.0'),
      __BUILD_HASH__: JSON.stringify(commitHash),
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/jszip')) {
              return 'vendor-excel';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('src/components/relatorios') || id.includes('src/components/RelatoriosXmlPanel')) {
              return 'module-relatorios';
            }
            if (id.includes('src/components/TabelasFiscaisPanel') || id.includes('src/components/SimuladorRegimesPanel') || id.includes('src/components/ApuracaoAssistidaPanel')) {
              return 'module-tributario';
            }
            if (id.includes('src/components/ParceirosNegocioPanel') || id.includes('src/components/CarteiraCnpjsPanel')) {
              return 'module-cadastros';
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
