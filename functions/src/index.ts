import { getApps, initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { apiApp } from './api/index.js';

if (!getApps().length) {
  initializeApp();
}

setGlobalOptions({ region: 'us-central1', memory: '256MiB' });

export const api = onRequest(apiApp);

export const aiIndex = onRequest((req, res) => {
  res.set('Content-Type', 'application/json');
  res.status(200).send(
    JSON.stringify({
      message: 'AI index placeholder response',
      path: req.path,
      timestamp: new Date().toISOString(),
    }),
  );
});

export const dashboardApp = onRequest((_req, res) => {
  res.status(200).send('Dashboard application placeholder. Implement SSR or proxy logic here.');
});

export * from './triggers/menus.js';
