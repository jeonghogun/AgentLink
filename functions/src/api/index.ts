import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { ApiError, fetchMenuWithStore, searchMenus } from '../lib/db.js';
import { createOrder, getOrderStatus } from '../lib/orders.js';
import { metricsMiddleware } from './metrics.js';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function createApiApp(): express.Express {
  const app = express();

  const allowedOrigins = buildAllowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
          callback(null, true);
          return;
        }

        callback(new ApiError(403, 'cors/not-allowed', '허용되지 않은 출처입니다.', 'API_ALLOWED_ORIGINS 환경 변수를 업데이트해주세요.'));
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(metricsMiddleware);

  app.get(
    '/health',
    (_req, res) => {
      res.status(200).json({ ok: true, ts: new Date().toISOString() });
    },
  );

  app.get(
    '/search',
    asyncHandler(async (req, res) => {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined;
      const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;

      const results = await searchMenus({ region, keyword, limit: limitRaw });
      const titles = results
        .map((entry) => entry.menu.title || entry.menu.name || '')
        .filter((title) => title.length > 0);

      res.status(200).json({ titles });
    }),
  );

  app.get(
    '/menu/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { menu, store } = await fetchMenuWithStore(id);

      const optionGroups = Array.isArray(menu.option_groups) ? menu.option_groups : [];
      const description = typeof menu.description === 'string' ? menu.description : '';
      const rules = Array.isArray(store.delivery?.rules) ? store.delivery?.rules : [];
      const rating = menu.rating ?? store.rating ?? null;

      res.status(200).json({
        title: menu.title ?? menu.name ?? '',
        content: {
          option_groups: optionGroups,
          description,
          delivery: { rules },
          rating,
        },
      });
    }),
  );

  app.post(
    '/order',
    asyncHandler(async (req, res) => {
      const result = await createOrder(req.body);
      res.status(201).json(result);
    }),
  );

  app.get(
    '/order/:id/status',
    asyncHandler(async (req, res) => {
      const result = await getOrderStatus(req.params.id);
      res.status(200).json(result);
    }),
  );

  app.use((_req, _res, next) => {
    next(new ApiError(404, 'route/not-found', '요청한 API 경로를 찾을 수 없습니다.', '엔드포인트 경로를 다시 확인해주세요.'));
  });

  app.use(errorHandler);

  return app;
}

export const apiApp = createApiApp();

function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const normalized = normalizeError(error);
  const payload: Record<string, unknown> = {
    code: normalized.code,
    message: normalized.message,
  };

  if (normalized.hint) {
    payload.hint = normalized.hint;
  }

  if (normalized.details) {
    Object.assign(payload, normalized.details);
  }

  res.status(normalized.status).json(payload);
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(500, 'internal/error', '요청 처리 중 오류가 발생했습니다.', error.message);
  }

  return new ApiError(500, 'internal/error', '요청 처리 중 알 수 없는 오류가 발생했습니다.');
}

function buildAllowedOrigins(): Set<string> {
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const extra = (process.env.API_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return new Set([...defaults, ...extra]);
}
