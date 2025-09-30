import { auth } from '../config/firebase';
import type { ApiErrorPayload } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly status: number;

  constructor(status: number, code: string, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

async function buildHeaders(initHeaders?: HeadersInit): Promise<HeadersInit> {
  const headers = new Headers(initHeaders);
  headers.set('Content-Type', 'application/json');
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await buildHeaders(options.headers);
  const response = await fetch(path, { ...options, headers });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch (error) {
      // ignore parsing error
    }
    if (payload) {
      throw new ApiError(response.status, payload.code, payload.message, payload.hint);
    }
    throw new ApiError(response.status, 'api/error', 'API 요청에 실패했습니다.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function dashboardPath(path: string): string {
  return `/api/dashboard${path}`;
}
