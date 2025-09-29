import cors from 'cors';
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';

setGlobalOptions({ region: 'us-central1', memory: '256MiB' });

const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());

apiApp.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiApp.get('/version', (_req, res) => {
  res.json({ version: '0.1.0' });
});

export const api = onRequest(apiApp);

export const aiIndex = onRequest((req, res) => {
  res.set('Content-Type', 'application/json');
  res.status(200).send(
    JSON.stringify({
      message: 'AI index placeholder response',
      path: req.path,
      timestamp: new Date().toISOString()
    }),
  );
});

export const dashboardApp = onRequest((_req, res) => {
  res.status(200).send('Dashboard application placeholder. Implement SSR or proxy logic here.');
});
