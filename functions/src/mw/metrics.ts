import { type NextFunction, type Request, type Response } from 'express';
import { ApiError, getDb } from '../lib/db.js';

interface RouteMetrics {
  count: number;
  avg_ms: number;
  fail: number;
}

interface MetricsDocument {
  api?: Record<string, RouteMetrics>;
  token_savings?: {
    latest?: TokenSavingsSample;
  };
}

interface MetricsTokenPayload {
  optimized: string;
  baseline: string;
}

export interface TokenSavingsSample {
  optimized_tokens: number;
  baseline_tokens: number;
  savings_ratio: number;
  savings_percent: number;
  captured_at: string;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  tryConsume(key: string, now: number): boolean {
    if (!key) {
      key = 'unknown';
    }

    const bucket = this.buckets.get(key);
    if (!bucket) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (now - bucket.windowStart >= this.windowMs) {
      bucket.count = 1;
      bucket.windowStart = now;
      return true;
    }

    if (bucket.count >= this.limit) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}

const limiter = new RateLimiter(60, 60_000);

export function attachTokenMetricsPayload(res: Response, payload: MetricsTokenPayload): void {
  (res.locals as Record<string, unknown>).metricsTokenPayload = payload;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const ip = extractClientIp(req);
  const now = Date.now();
  if (!limiter.tryConsume(ip, now)) {
    next(new ApiError(429, 'rate-limit/exceeded', '요청 한도를 초과했습니다.', '잠시 후 다시 시도해주세요.'));
    return;
  }

  const start = process.hrtime.bigint();
  const routeKey = normalizeRouteKey(req.originalUrl ?? req.url ?? 'unknown');

  const originalJson = res.json.bind(res);
  let responsePayload: unknown;
  res.json = function patchedJson(body: unknown) {
    responsePayload = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const failed = res.statusCode >= 400;
    const shard = getShardId(new Date());

    let tokenPayload: MetricsTokenPayload | undefined;
    const locals = res.locals as Record<string, unknown> & { metricsTokenPayload?: unknown };
    if (locals && isTokenPayload(locals.metricsTokenPayload)) {
      tokenPayload = locals.metricsTokenPayload;
    } else if (routeKey === '/api/search' && isSearchResponse(responsePayload)) {
      tokenPayload = buildSearchTokenPayload(responsePayload);
    }

    void recordMetrics({ shard, routeKey, durationMs, failed, tokenPayload });
  });

  next();
}

export function estimateTokens(str: string): number {
  if (!str) {
    return 0;
  }
  const length = [...str].length;
  return Math.ceil(length / 4);
}

export function calculateTokenSavings(payload: MetricsTokenPayload, timestamp: Date = new Date()): TokenSavingsSample | undefined {
  const optimizedTokens = estimateTokens(payload.optimized);
  const baselineTokens = estimateTokens(payload.baseline);

  if (baselineTokens <= 0) {
    return undefined;
  }

  const savingsRatio = (baselineTokens - optimizedTokens) / baselineTokens;
  const savingsPercent = Number((savingsRatio * 100).toFixed(2));

  return {
    optimized_tokens: optimizedTokens,
    baseline_tokens: baselineTokens,
    savings_ratio: Number(savingsRatio.toFixed(4)),
    savings_percent: savingsPercent,
    captured_at: timestamp.toISOString(),
  };
}

function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const [first] = forwarded.split(',');
    if (first) {
      return first.trim();
    }
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? '';
  }

  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function normalizeRouteKey(originalUrl: string): string {
  if (!originalUrl) {
    return 'unknown';
  }

  const [path] = originalUrl.split('?');
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

function getShardId(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isTokenPayload(value: unknown): value is MetricsTokenPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).optimized === 'string' &&
    typeof (value as Record<string, unknown>).baseline === 'string'
  );
}

function isSearchResponse(value: unknown): value is { titles?: unknown } {
  return !!value && typeof value === 'object' && 'titles' in value;
}

function buildSearchTokenPayload(response: { titles?: unknown }): MetricsTokenPayload | undefined {
  if (!Array.isArray(response.titles)) {
    return undefined;
  }

  const titles = response.titles.filter((title): title is string => typeof title === 'string');
  const optimized = JSON.stringify({ titles });
  const baseline = JSON.stringify({
    baemin_like_json: titles.map((title) => ({
      title,
      content: title,
    })),
  });

  return { optimized, baseline };
}

async function recordMetrics(params: {
  shard: string;
  routeKey: string;
  durationMs: number;
  failed: boolean;
  tokenPayload?: MetricsTokenPayload;
}): Promise<void> {
  try {
    const db = getDb();
    const docRef = db.collection('metrics').doc(params.shard);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(docRef);
      const data = (snapshot.exists ? (snapshot.data() as MetricsDocument) : {}) ?? {};
      const apiMetrics = data.api ?? {};
      const currentRouteMetrics = apiMetrics[params.routeKey] ?? { count: 0, avg_ms: 0, fail: 0 };
      const nextCount = currentRouteMetrics.count + 1;
      const totalDuration = currentRouteMetrics.avg_ms * currentRouteMetrics.count + params.durationMs;
      const nextAvg = Number((totalDuration / nextCount).toFixed(2));

      const updated: MetricsDocument = {
        api: {
          ...apiMetrics,
          [params.routeKey]: {
            count: nextCount,
            avg_ms: nextAvg,
            fail: currentRouteMetrics.fail + (params.failed ? 1 : 0),
          },
        },
      };

      if (params.tokenPayload) {
        const sample = calculateTokenSavings(params.tokenPayload);
        if (sample) {
          updated.token_savings = {
            ...(data.token_savings ?? {}),
            latest: sample,
          };
        }
      }

      tx.set(docRef, updated, { merge: true });
    });
  } catch (error) {
    console.error('[metrics] failed to record metrics', error);
  }
}

export async function loadMetricsSummary(shard?: string): Promise<MetricsDocument & { shard: string }> {
  const db = getDb();
  const targetShard = shard || getShardId(new Date());
  const snapshot = await db.collection('metrics').doc(targetShard).get();
  const data = (snapshot.exists ? (snapshot.data() as MetricsDocument) : {}) ?? {};
  return { shard: targetShard, ...data };
}

export type { MetricsDocument, MetricsTokenPayload };
