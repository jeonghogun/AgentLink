import { Firestore, getFirestore } from 'firebase-admin/firestore';

export interface RuntimeWeights {
  price: number;
  rating: number;
  fee: number;
}

export interface StoreDocument {
  id: string;
  name?: string;
  region?: string;
  status?: string;
  delivery?: {
    available?: boolean;
    base_fee?: number;
    rules?: unknown[];
  };
  rating?: {
    score?: number;
    count?: number;
  };
  owner_uid?: string;
}

export interface MenuDocument {
  id: string;
  store_id?: string;
  title?: string;
  title_v?: number;
  name?: string;
  price?: number;
  currency?: string;
  stock?: unknown;
  option_groups?: unknown[];
  rating?: {
    score?: number;
    count?: number;
  };
  images?: unknown[];
  description?: string;
}

export interface MenuSearchParams {
  region?: string;
  keyword?: string;
  limit?: number;
}

export interface MenuSearchResult {
  menu: MenuDocument;
  store: StoreDocument;
  score: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly hint?: string;

  constructor(status: number, code: string, message: string, hint?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

let cachedDb: Firestore | undefined;

export function getDb(): Firestore {
  if (!cachedDb) {
    cachedDb = getFirestore();
    cachedDb.settings({ ignoreUndefinedProperties: true });
  }

  return cachedDb;
}

export async function loadRuntimeWeights(): Promise<RuntimeWeights> {
  const db = getDb();
  try {
    const snapshot = await db.collection('settings').doc('runtime').get();
    if (!snapshot.exists) {
      return { price: 0.3, rating: 0.5, fee: 0.2 };
    }

    const data = snapshot.data() ?? {};
    const weights = data.weights ?? {};

    return {
      price: Number(weights.price) || 0,
      rating: Number(weights.rating) || 0,
      fee: Number(weights.fee) || 0,
    };
  } catch (error) {
    throw mapFirestoreError('settings/runtime', error);
  }
}

export async function fetchMenuWithStore(menuId: string): Promise<{ menu: MenuDocument; store: StoreDocument }>
{
  const db = getDb();
  try {
    const menuSnap = await db.collection('menus').doc(menuId).get();
    if (!menuSnap.exists) {
      throw new ApiError(404, 'menu/not-found', '요청한 메뉴를 찾을 수 없습니다.', 'menuId 값을 확인해주세요.');
    }

    const menu = { id: menuSnap.id, ...(menuSnap.data() as Record<string, unknown>) } as MenuDocument;
    if (!menu.store_id) {
      throw new ApiError(500, 'menu/missing-store', '메뉴에 연결된 매장 정보가 없습니다.', '시드 데이터 혹은 메뉴 문서를 확인해주세요.');
    }

    const storeSnap = await db.collection('stores').doc(menu.store_id).get();
    if (!storeSnap.exists) {
      throw new ApiError(404, 'store/not-found', '연결된 매장 정보를 찾을 수 없습니다.', 'store 문서가 존재하는지 확인해주세요.');
    }

    const store = { id: storeSnap.id, ...(storeSnap.data() as Record<string, unknown>) } as StoreDocument;
    return { menu, store };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapFirestoreError(`menus/${menuId}`, error);
  }
}

export async function searchMenus(params: MenuSearchParams): Promise<MenuSearchResult[]> {
  const db = getDb();
  const limit = clampLimit(params.limit);
  const keyword = params.keyword?.toLowerCase().trim();
  const region = params.region?.toLowerCase().trim();

  try {
    const querySnapshot = await db.collection('menus').limit(limit * 5).get();
    const menus = querySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as MenuDocument[];
    const storeIds = Array.from(new Set(menus.map((menu) => menu.store_id).filter((id): id is string => Boolean(id))));

    const storeSnapshots = await Promise.all(storeIds.map(async (id) => {
      const snap = await db.collection('stores').doc(id).get();
      return { id, snap };
    }));

    const stores = new Map<string, StoreDocument>();
    for (const { id, snap } of storeSnapshots) {
      if (snap.exists) {
        stores.set(id, { id, ...(snap.data() as Record<string, unknown>) } as StoreDocument);
      }
    }

    const weights = await loadRuntimeWeights();

    const filtered: MenuSearchResult[] = [];
    for (const menu of menus) {
      if (!menu.store_id) {
        continue;
      }

      const store = stores.get(menu.store_id);
      if (!store) {
        continue;
      }

      if ((store.status ?? '').toLowerCase() !== 'open') {
        continue;
      }

      if (isOutOfStock(menu.stock)) {
        continue;
      }

      if (region && (store.region ?? '').toLowerCase() !== region) {
        continue;
      }

      if (keyword && !matchesKeyword(keyword, menu, store)) {
        continue;
      }

      const score = calculateWeightedScore(menu, store, weights);
      filtered.push({ menu, store, score });
      if (filtered.length >= limit * 2) {
        break;
      }
    }

    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, limit);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw mapFirestoreError('menus/search', error);
  }
}

function matchesKeyword(keyword: string, menu: MenuDocument, store: StoreDocument): boolean {
  const haystacks = [menu.name, menu.title, store.name].filter(Boolean).map((value) => String(value).toLowerCase());
  return haystacks.some((value) => value.includes(keyword));
}

function calculateWeightedScore(menu: MenuDocument, store: StoreDocument, weights: RuntimeWeights): number {
  const price = Number(menu.price) || 0;
  const rating = Number(menu.rating?.score) || 0;
  const fee = Number(store.delivery?.base_fee) || 0;

  const ratingScore = rating * weights.rating;
  const priceScore = price * weights.price;
  const feeScore = fee * weights.fee;

  return ratingScore - priceScore - feeScore;
}

function isOutOfStock(stock: unknown): boolean {
  if (typeof stock === 'string') {
    return stock.toLowerCase() === 'out_of_stock' || stock.toLowerCase() === 'out-of-stock';
  }

  if (typeof stock === 'number') {
    return stock <= 0;
  }

  return false;
}

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) {
    return 10;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 50);
}

function mapFirestoreError(context: string, error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '알 수 없는 Firestore 오류가 발생했습니다.';
  return new ApiError(500, 'firestore/error', `Firestore(${context}) 요청 중 오류가 발생했습니다.`, message);
}
