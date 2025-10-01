import { randomUUID } from 'crypto';

export interface AppError extends Error {
  code: string;
  status?: number;
  hint?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

interface ErrorExtras {
  status?: number;
  hint?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
  requestId?: string;
}

const STATUS_BY_CODE: Record<string, number> = {
  E01: 409,
  E02: 409,
  E03: 409,
  'auth/unauthorized': 401,
  'auth/forbidden': 403,
  'order/invalid-payload': 400,
  'order/invalid-user': 400,
  'order/empty-items': 400,
  'order/invalid-item': 400,
  'order/missing-menu': 400,
  'order/invalid-quantity': 400,
  'order/invalid-id': 400,
  'order/not-found': 404,
  'order/missing-store': 500,
  'menu/not-found': 404,
  'menu/missing-store': 500,
  'menu/invalid-payload': 400,
  'menu/unauthorized': 403,
  'store/not-found': 404,
  'store/invalid-payload': 400,
  'store/unauthorized': 403,
  'firestore/error': 500,
  'orchestrate/no-candidates': 404,
  'orchestrate/order-failed': 500,
  'orchestrate/order-cancelled': 409,
  'orchestrate/order-timeout': 504,
  'orchestrate/order-summary-failed': 500,
  'metrics/unauthorized': 401,
  'rate-limit/exceeded': 429,
  'cors/not-allowed': 403,
  'ai/not-found': 404,
  'ai/internal-error': 500,
  'route/not-found': 404,
  'internal/error': 500,
};

export function createError(code: string, message: string, extras: ErrorExtras = {}): AppError {
  const error = new Error(message) as AppError;
  error.name = 'AppError';
  error.code = code;
  error.status = extras.status ?? STATUS_BY_CODE[code] ?? 500;
  error.hint = extras.hint;
  if (extras.details) {
    error.details = extras.details;
  }
  if (extras.requestId) {
    error.requestId = extras.requestId;
  }
  if (extras.cause instanceof Error && !(error as { cause?: Error }).cause) {
    (error as { cause?: Error }).cause = extras.cause;
  }
  return error;
}

export function isAppError(error: unknown): error is AppError {
  return Boolean(error) && typeof error === 'object' && 'code' in (error as Record<string, unknown>);
}

export function ensureRequestId(error: AppError, fallback?: string): AppError {
  if (!error.requestId) {
    error.requestId = fallback ?? randomUUID();
  }
  return error;
}
