import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001/agentlink-391f7/us-central1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/ai': {
        target: 'http://localhost:5001/agentlink-391f7/us-central1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ai/, '/ai'),
      },
      '/dashboard': {
        target: 'http://localhost:5001/agentlink-391f7/us-central1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/dashboard/, '/dashboard'),
      },
    },
  },
  preview: {
    port: 4173,
  },
});
