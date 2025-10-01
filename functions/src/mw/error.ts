import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError, createError, ensureRequestId, isAppError } from '../lib/errors.js';

const STATUS_BY_PREFIX: Array<{ prefix: string; status: number }> = [
  { prefix: 'order/', status: 400 },
  { prefix: 'menu/', status: 400 },
  { prefix: 'store/', status: 400 },
  { prefix: 'metrics/', status: 401 },
  { prefix: 'orchestrate/', status: 500 },
  { prefix: 'ai/', status: 500 },
];

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = extractRequestId(req) ?? req.headers['x-request-id'];
  const requestId = typeof existing === 'string' && existing ? existing : randomUUID();

  (req as Request & { requestId?: string }).requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  console.info(`[${requestId}] ➜ ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    console.info(`[${requestId}] ⇦ ${res.statusCode} ${req.method} ${req.originalUrl}`);
  });

  next();
}

export function errorMiddleware(error: unknown, req: Request, res: Response): void {
  let normalized: AppError;
  if (isAppError(error)) {
    normalized = error;
  } else if (error instanceof Error) {
    normalized = createError('internal/error', '요청 처리 중 오류가 발생했습니다.', {
      status: 500,
      details: { cause: error.message },
      cause: error,
    });
  } else {
    normalized = createError('internal/error', '요청 처리 중 알 수 없는 오류가 발생했습니다.', { status: 500 });
  }

  const requestId = res.locals.requestId ?? extractRequestId(req) ?? randomUUID();
  ensureRequestId(normalized, requestId);

  if (!normalized.status) {
    normalized.status = resolveStatus(normalized.code);
  }

  const payload: Record<string, unknown> = {
    request_id: normalized.requestId,
    code: normalized.code,
    message: normalized.message,
  };

  if (normalized.hint) {
    payload.hint = normalized.hint;
  }

  if (normalized.details) {
    payload.details = normalized.details;
    const maybeAlternatives = (normalized.details as Record<string, unknown>).alternatives;
    if (maybeAlternatives !== undefined && !('alternatives' in payload)) {
      payload.alternatives = maybeAlternatives;
    }
  }

  console.error(
    `[${normalized.requestId}] ✖ ${req.method} ${req.originalUrl} -> ${normalized.status} ${normalized.code}`,
    normalized.details ?? {},
  );

  res.status(normalized.status ?? 500).json(payload);
}

function resolveStatus(code: string): number {
  for (const entry of STATUS_BY_PREFIX) {
    if (code.startsWith(entry.prefix)) {
      return entry.status;
    }
  }
  return 500;
}

function extractRequestId(req: Request): string | undefined {
  const reqWithId = req as Request & { requestId?: string };
  if (typeof reqWithId.requestId === 'string') {
    return reqWithId.requestId;
  }
  const header = req.headers['x-request-id'];
  if (typeof header === 'string') {
    return header;
  }
  if (Array.isArray(header) && header.length > 0) {
    return header[0];
  }
  return undefined;
}
