import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectId =
  process.env.FIREBASE_EMULATOR_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT ??
  'agentlink-391f7';

const functionsRegion = process.env.FUNCTIONS_REGION ?? 'us-central1';
const functionsBasePath = `/${projectId}/${functionsRegion}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => path.replace(/^\/api/, `${functionsBasePath}/api`),
        changeOrigin: false,
      },
      '/ai': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => path.replace(/^\/ai/, `${functionsBasePath}/aiIndex`),
        changeOrigin: false,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => path.replace(/^\/dashboard/, `${functionsBasePath}/dashboardApp`),
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
