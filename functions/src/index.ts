import { getApps, initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { apiApp } from './api/index.js';
import { aiHandler } from './ai/index.js';

if (!getApps().length) {
  initializeApp();
}

setGlobalOptions({ region: 'us-central1', memory: '256MiB' });

export const api = onRequest(apiApp);

export const aiIndex = onRequest(aiHandler);

export const dashboardApp = onRequest((_req, res) => {
  res.status(200).send('Dashboard application placeholder. Implement SSR or proxy logic here.');
});

export * from './triggers/menus.js';
