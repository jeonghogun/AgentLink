import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import {
  ApiError,
  fetchMenuWithStore,
  getDb,
  loadRuntimeWeights,
  searchMenus,
} from '../lib/db.js';
import type { MenuDocument, MenuSearchResult, RuntimeWeights, StoreDocument } from '../lib/db.js';
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

  app.post(
    '/orchestrate',
    asyncHandler(async (req, res) => {
      const { region, keyword, preferences } = normalizeOrchestratePayload(req.body);

      const primaryResults = await searchMenus({ region, keyword, limit: 12 });
      let candidates = filterHogunTitles(primaryResults);

      if (!candidates.length && region) {
        const fallbackResults = await searchMenus({ region: undefined, keyword, limit: 12 });
        candidates = filterHogunTitles(fallbackResults);
      }

      if (!candidates.length) {
        throw new ApiError(
          404,
          'orchestrate/no-candidates',
          '조건에 맞는 메뉴를 찾지 못했습니다.',
          '검색 지역이나 키워드를 완화해 다시 시도해주세요.',
          { step: 'search', cause: 'empty' },
        );
      }

      const weights = await resolveWeights(preferences);
      const ranked = rankCandidates(candidates, weights);
      const choice = ranked[0];

      const { menu, store } = await fetchMenuWithStore(choice.menu.id);
      const recommendedOptions = recommendOptions(menu.option_groups);

      let order;
      try {
        order = await createOrder({
          user_id: 'runtime-orchestrator',
          items: [
            {
              menu_id: menu.id,
              qty: 1,
              selected_options: recommendedOptions,
            },
          ],
        });
      } catch (error) {
        if (error instanceof ApiError) {
          throw new ApiError(error.status, error.code, error.message, error.hint, {
            ...(error.details ?? {}),
            step: 'order',
          });
        }

        throw new ApiError(500, 'orchestrate/order-failed', '주문 생성 중 오류가 발생했습니다.', '잠시 후 다시 시도해주세요.', {
          step: 'order',
          cause: error instanceof Error ? error.message : 'unknown',
        });
      }

      await waitForCompletion(order.order_id);

      const summary = await loadOrderSummary(order.order_id);
      const response = buildSummaryResponse({ menu, store, summary, recommendedOptions });

      res.status(200).json(response);
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

interface OrchestratePreferences {
  price_weight?: number;
  rating_weight?: number;
  fee_weight?: number;
}

function normalizeOrchestratePayload(payload: unknown): {
  region?: string;
  keyword?: string;
  preferences?: OrchestratePreferences;
} {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(
      400,
      'orchestrate/invalid-payload',
      '요청 본문이 올바르지 않습니다.',
      'JSON 객체 형태로 region, keyword를 전달해주세요.',
      { step: 'input', cause: 'non-object' },
    );
  }

  const { region, keyword, preferences } = payload as Record<string, unknown>;

  const normalizedRegion = typeof region === 'string' ? region.trim() || undefined : undefined;
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() || undefined : undefined;
  const normalizedPreferences =
    preferences && typeof preferences === 'object' ? (preferences as OrchestratePreferences) : undefined;

  return {
    region: normalizeRegion(normalizedRegion),
    keyword: normalizedKeyword,
    preferences: normalizedPreferences,
  };
}

function normalizeRegion(region: string | undefined): string | undefined {
  if (!region) {
    return undefined;
  }

  return region.replace(/\s+/g, '_').trim();
}

function filterHogunTitles(results: MenuSearchResult[]): MenuSearchResult[] {
  const suffixPattern = /_{1,2}hogun$/i;
  return results.filter((entry) => {
    const title = typeof entry.menu.title === 'string' ? entry.menu.title : '';
    if (!title) {
      return false;
    }

    return suffixPattern.test(title);
  });
}

async function resolveWeights(preferences?: OrchestratePreferences): Promise<RuntimeWeights> {
  const fallback = await loadRuntimeWeights();
  if (!preferences) {
    return fallback;
  }

  const coerce = (value: unknown, defaultValue: number): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return defaultValue;
    }
    return num;
  };

  return {
    price: coerce(preferences.price_weight, fallback.price),
    rating: coerce(preferences.rating_weight, fallback.rating),
    fee: coerce(preferences.fee_weight, fallback.fee),
  };
}

function rankCandidates(results: MenuSearchResult[], weights: RuntimeWeights): Array<MenuSearchResult & { score: number }> {
  const ranked = results.map((entry) => ({
    ...entry,
    score: calculateCandidateScore(entry.menu, entry.store, weights),
  }));

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function calculateCandidateScore(menu: MenuDocument, store: StoreDocument, weights: RuntimeWeights): number {
  const price = Number(menu.price) || 0;
  const rating = Number(menu.rating?.score) || 0;
  const fee = Number(store.delivery?.base_fee) || 0;

  return rating * weights.rating - price * weights.price - fee * weights.fee;
}

function recommendOptions(optionGroups: unknown): Array<{ id: string; price: number; label?: string }> {
  if (!Array.isArray(optionGroups)) {
    return [];
  }

  const selections: Array<{ id: string; price: number; label?: string }> = [];

  for (const group of optionGroups) {
    if (!group || typeof group !== 'object') {
      continue;
    }

    const options = Array.isArray((group as Record<string, unknown>).options)
      ? ((group as Record<string, unknown>).options as Array<Record<string, unknown>>)
      : [];

    const normalizedOptions: Array<{ id: string; price: number; label?: string }> = [];
    for (const option of options) {
      const idRaw = option.id ?? option.option_id ?? option.value;
      const id = typeof idRaw === 'string' ? idRaw : idRaw != null ? String(idRaw) : '';
      if (!id) {
        continue;
      }

      const priceRaw = option.price ?? option.cost ?? option.amount ?? 0;
      const price = Number(priceRaw);
      const labelRaw = option.label ?? option.name ?? option.title;
      const label = typeof labelRaw === 'string' ? labelRaw : undefined;

      normalizedOptions.push({
        id,
        price: Number.isFinite(price) ? Number(price) : 0,
        label,
      });
    }

    if (!normalizedOptions.length) {
      continue;
    }

    normalizedOptions.sort((a, b) => a.price - b.price);
    const chosen = normalizedOptions[0];
    if (chosen) {
      selections.push(chosen);
    }

    if (selections.length >= 2) {
      break;
    }
  }

  return selections;
}

async function waitForCompletion(orderId: string): Promise<void> {
  const timeoutMs = 60_000;
  const pollIntervalMs = 5_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getOrderStatus(orderId);
    if (status.status === 'completed') {
      return;
    }

    if (status.status === 'cancelled') {
      throw new ApiError(409, 'orchestrate/order-cancelled', '주문이 취소되었습니다.', '다른 메뉴를 선택해 다시 시도해주세요.', {
        step: 'order-status',
        cause: 'cancelled',
        order_id: orderId,
      });
    }

    await delay(pollIntervalMs);
  }

  throw new ApiError(504, 'orchestrate/order-timeout', '주문 완료를 확인하지 못했습니다.', '네트워크 상태를 확인 후 다시 요청해주세요.', {
    step: 'order-status',
    cause: 'timeout',
    order_id: orderId,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadOrderSummary(orderId: string): Promise<{ total_price: number; eta_minutes: number }> {
  try {
    const snapshot = await getDb().collection('orders').doc(orderId).get();
    if (!snapshot.exists) {
      throw new ApiError(404, 'order/not-found', '주문 정보를 찾을 수 없습니다.', 'order_id를 다시 확인해주세요.', {
        step: 'order-summary',
        cause: 'missing',
      });
    }

    const data = snapshot.data() ?? {};
    const totalPriceRaw = (data as Record<string, unknown>).total_price;
    const etaRaw = (data as Record<string, unknown>).eta_minutes;

    const total_price = coerceNumeric(totalPriceRaw);
    const eta_minutes = coerceNumeric(etaRaw);

    return { total_price, eta_minutes };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'orchestrate/order-summary-failed', '주문 요약 정보를 불러오지 못했습니다.', '잠시 후 다시 시도해주세요.', {
      step: 'order-summary',
      cause: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function buildSummaryResponse({
  menu,
  store,
  summary,
  recommendedOptions,
}: {
  menu: MenuDocument;
  store: StoreDocument;
  summary: { total_price: number; eta_minutes: number };
  recommendedOptions: Array<{ id: string; price: number; label?: string }>;
}) {
  const storeName = store.name ?? store.id ?? '선택 매장';
  const menuName = menu.name ?? menu.title ?? '추천 메뉴';
  const priceTotal = summary.total_price;
  const etaMinutes = summary.eta_minutes;
  const currency = menu.currency ?? 'KRW';

  const sentences: string[] = [];
  sentences.push(`${storeName}에서 ${menuName}를 자동으로 선택해 주문했습니다.`);
  sentences.push(`총 결제 금액은 ${formatCurrency(priceTotal, currency)}이며 예상 도착 시간은 약 ${etaMinutes}분입니다.`);

  if (recommendedOptions.length) {
    const optionText = recommendedOptions.map((option) => option.label ?? option.id).join(', ');
    sentences.push(`추천 옵션: ${optionText}.`);
  }

  return {
    store: storeName,
    menu: menuName,
    price_total: priceTotal,
    eta_minutes: etaMinutes,
    summary: sentences.slice(0, 3),
  };
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString('ko-KR')} ${currency}`;
  }
}

function coerceNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
