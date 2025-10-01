import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getDb, mapFirestoreError } from '../lib/db.js';
import { AppError, createError, isAppError } from '../lib/errors.js';

const CACHE_HEADER_SUCCESS = 'public, s-maxage=60, must-revalidate';
const CACHE_HEADER_ERROR = 'public, max-age=0, must-revalidate';

export async function aiHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET') {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', CACHE_HEADER_ERROR);
    res.status(405).json({
      code: 'method/not-allowed',
      message: 'GET 메서드만 지원합니다.',
    });
    return;
  }

  const normalizedPath = normalizePath(req.path || req.url || '');

  try {
    if (isIndexPath(normalizedPath)) {
      const payload = await buildIndexPayload();
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Cache-Control', CACHE_HEADER_SUCCESS);
      res.status(200).json(payload);
      return;
    }

    const storeMatch = normalizedPath.match(/^\/ai\/store\/([^/]+)\.json$/i);
    if (storeMatch) {
      const storeId = decodeURIComponent(storeMatch[1]);
      const payload = await buildStorePayload(storeId);
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Cache-Control', CACHE_HEADER_SUCCESS);
      res.status(200).json(payload);
      return;
    }

    throw createError('ai/not-found', '요청한 AI 인덱스 경로를 찾을 수 없습니다.', {
      status: 404,
      hint: '지원되는 엔드포인트를 확인해주세요.',
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', CACHE_HEADER_ERROR);
    const payload: Record<string, unknown> = {
      code: normalized.code,
      message: normalized.message,
    };

    if (normalized.hint) {
      payload.hint = normalized.hint;
    }

    if (normalized.details) {
      payload.details = normalized.details;
    }

    res.status(normalized.status ?? 500).json(payload);
  }
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

function isIndexPath(path: string): boolean {
  return path === '/ai' || path === '/ai/' || path.endsWith('/ai/index.json') || path === '/ai/index.json';
}

async function buildIndexPayload(): Promise<{
  version: number;
  updated_at: string;
  stores: Array<{ store_id: string; region?: string; name?: string }>;
}> {
  const db = getDb();
  try {
    const snapshot = await db.collection('stores').limit(200).get();
    const stores = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        store_id: doc.id,
        region: typeof data.region === 'string' ? data.region : undefined,
        name: typeof data.name === 'string' ? data.name : undefined,
      };
    });

    return {
      version: 1,
      updated_at: new Date().toISOString(),
      stores,
    };
  } catch (error) {
    throw mapFirestoreError('stores/index', error);
  }
}

async function buildStorePayload(storeId: string): Promise<{
  version: number;
  updated_at: string;
  store: { store_id: string; name?: string; region?: string; status?: string };
  menus: Array<{
    menu_id: string;
    title: string;
    content: { description?: string; price?: number; currency?: string };
  }>;
}> {
  const db = getDb();
  try {
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      throw createError('store/not-found', '해당 매장을 찾을 수 없습니다.', {
        status: 404,
        hint: 'storeId 값을 다시 확인해주세요.',
      });
    }

    const storeData = storeSnap.data() as Record<string, unknown>;
    const menusSnap = await db.collection('menus').where('store_id', '==', storeId).get();
    const menus = menusSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const title = selectMenuTitle(data);
      const description = extractDescription(data.description);
      const price = extractNumber(data.price);
      const currency = typeof data.currency === 'string' ? data.currency : undefined;

      return {
        menu_id: doc.id,
        title,
        content: {
          description,
          ...(price !== undefined ? { price } : {}),
          ...(currency ? { currency } : {}),
        },
      };
    });

    return {
      version: 1,
      updated_at: new Date().toISOString(),
      store: {
        store_id: storeSnap.id,
        name: typeof storeData.name === 'string' ? storeData.name : undefined,
        region: typeof storeData.region === 'string' ? storeData.region : undefined,
        status: typeof storeData.status === 'string' ? storeData.status : undefined,
      },
      menus,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw mapFirestoreError(`stores/${storeId}/menus`, error);
  }
}

function selectMenuTitle(data: Record<string, unknown>): string {
  const title = typeof data.title === 'string' ? data.title : undefined;
  if (title && title.length > 0) {
    return title;
  }
  const name = typeof data.name === 'string' ? data.name : '';
  return name;
}

function extractDescription(description: unknown): string | undefined {
  if (typeof description !== 'string') {
    return undefined;
  }

  const trimmed = description.trim();
  if (trimmed.length <= 180) {
    return trimmed || undefined;
  }

  return `${trimmed.slice(0, 177)}...`;
}

function extractNumber(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return undefined;
  }
  return num;
}

function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError('ai/internal-error', 'AI 인덱스 처리 중 오류가 발생했습니다.', {
      status: 500,
      details: { cause: error.message },
    });
  }

  return createError('ai/internal-error', 'AI 인덱스 처리 중 알 수 없는 오류가 발생했습니다.', { status: 500 });
}
