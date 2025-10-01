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

export * from './triggers/menus.js';
