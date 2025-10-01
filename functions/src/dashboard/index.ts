import express from 'express';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

export function createDashboardApp() {
  const app = express();
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);
  const distDir = resolve(currentDir, '../../../web-dashboard/dist');

  if (existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: '1h', index: 'index.html' }));

    app.get('*', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'));
    });
  } else {
    app.get('*', (_req, res) => {
      res.status(500).json({
        code: 'DASHBOARD_NOT_BUILT',
        message: 'Dashboard bundle not found. Run `npm run -w web-dashboard build` before deploying.',
      });
    });
  }

  return app;
}
