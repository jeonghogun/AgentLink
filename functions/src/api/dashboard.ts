import express, { NextFunction, Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { buildTitle, type StoreDocument as TitleStoreDocument } from '../lib/title.js';
import { getDb, mapFirestoreError } from '../lib/db.js';
import { createError, isAppError } from '../lib/errors.js';

interface AuthedRequest extends Request {
  ownerUid?: string;
}

type StoreRecord = Record<string, unknown> & { id: string };
type MenuRecord = Record<string, unknown> & { id: string };
type OrderRecord = Record<string, unknown> & { id: string };

export function createDashboardRouter(): express.Router {
  const router = express.Router();
  router.use(express.json());
  router.use(authenticateMiddleware);

  router.get(
    '/store',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const store = await findPrimaryStore(ownerUid);
      res.status(200).json({ store: serializeStore(store) });
    }),
  );

  router.patch(
    '/store',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const store = await findPrimaryStore(ownerUid);
      const payload = normalizeStorePayload(req.body);

      const ref = getDb().collection('stores').doc(store.id);
      try {
        await ref.set(
          {
            ...payload,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        throw mapFirestoreError(`stores/${store.id}`, error);
      }

      const snapshot = await ref.get();
      const updatedStore = { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as StoreRecord;
      const titlePreview = await buildTitlePreviewForStore(updatedStore);

      res.status(200).json({ store: serializeStore(updatedStore), ...(titlePreview ? { title_preview: titlePreview } : {}) });
    }),
  );

  router.get(
    '/menus',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const storeIdParam = typeof req.query.storeId === 'string' ? req.query.storeId : undefined;
      const store = await resolveStoreByOwner(ownerUid, storeIdParam);

      try {
        const snapshot = await getDb().collection('menus').where('store_id', '==', store.id).orderBy('created_at', 'desc').limit(100).get();
        const menus = snapshot.docs.map((doc) =>
          serializeMenu({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as MenuRecord),
        );
        res.status(200).json({ menus });
      } catch (error) {
        throw mapFirestoreError(`stores/${store.id}/menus`, error);
      }
    }),
  );

  router.post(
    '/stores/:storeId/menus',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const { storeId } = req.params;
      const store = await resolveStoreByOwner(ownerUid, storeId);
      const payload = normalizeMenuPayload(req.body);

      const ref = getDb().collection('menus').doc();
      try {
        await ref.set({
          ...payload,
          store_id: store.id,
          title_v: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        throw mapFirestoreError(`menus/${ref.id}`, error);
      }

      const snapshot = await ref.get();
      const menuDoc = { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as MenuRecord;
      res.status(201).json({ menu: serializeMenu(menuDoc) });
    }),
  );

  router.put(
    '/menus/:menuId',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const { menuId } = req.params;
      const menu = await loadMenuWithOwnership(menuId, ownerUid);
      const payload = normalizeMenuPayload(req.body);

      const ref = getDb().collection('menus').doc(menu.id);
      try {
        await ref.set(
          {
            ...payload,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        throw mapFirestoreError(`menus/${menu.id}`, error);
      }

      const snapshot = await ref.get();
      const menuDoc = { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as MenuRecord;
      res.status(200).json({ menu: serializeMenu(menuDoc) });
    }),
  );

  router.delete(
    '/menus/:menuId',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const { menuId } = req.params;
      const menu = await loadMenuWithOwnership(menuId, ownerUid);

      try {
        await getDb().collection('menus').doc(menu.id).delete();
      } catch (error) {
        throw mapFirestoreError(`menus/${menu.id}`, error);
      }

      res.status(204).send();
    }),
  );

  router.get(
    '/orders',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const storeIdParam = typeof req.query.storeId === 'string' ? req.query.storeId : undefined;
      const store = await resolveStoreByOwner(ownerUid, storeIdParam);

      try {
        const snapshot = await getDb()
          .collection('orders')
          .where('store_id', '==', store.id)
          .orderBy('created_at', 'desc')
          .limit(50)
          .get();
        const orders = snapshot.docs.map((doc) =>
          serializeOrder({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OrderRecord),
        );
        res.status(200).json({ orders });
      } catch (error) {
        throw mapFirestoreError(`stores/${store.id}/orders`, error);
      }
    }),
  );

  router.get(
    '/orders/:orderId',
    asyncHandler(async (req, res) => {
      const ownerUid = getOwnerUid(req);
      const { orderId } = req.params;

      try {
        const snapshot = await getDb().collection('orders').doc(orderId).get();
        if (!snapshot.exists) {
          throw createError('order/not-found', '주문을 찾을 수 없습니다.', {
            status: 404,
            hint: 'orderId 값을 다시 확인해주세요.',
          });
        }

        const data = snapshot.data() as Record<string, unknown>;
        const storeId = typeof data.store_id === 'string' ? data.store_id : '';
        await resolveStoreByOwner(ownerUid, storeId);

        res.status(200).json({ order: serializeOrder({ id: snapshot.id, ...data } as OrderRecord) });
      } catch (error) {
        if (isAppError(error)) {
          throw error;
        }
        throw mapFirestoreError(`orders/${orderId}`, error);
      }
    }),
  );

  return router;
}

async function authenticateMiddleware(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw createError('auth/unauthorized', '로그인이 필요합니다.', {
        status: 401,
        hint: 'Firebase Auth 토큰을 포함해주세요.',
      });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw createError('auth/unauthorized', '로그인이 필요합니다.', {
        status: 401,
        hint: 'Firebase Auth 토큰을 포함해주세요.',
      });
    }

    const bypassEnabled = process.env.API_BYPASS_AUTH === 'true';
    const bypassToken = process.env.API_BYPASS_AUTH_TOKEN ?? 'test-token';
    if (bypassEnabled && token === bypassToken) {
      req.ownerUid = process.env.API_BYPASS_AUTH_UID ?? 'test-owner';
      next();
      return;
    }

    const decoded = await getAuth().verifyIdToken(token);
    req.ownerUid = decoded.uid;
    next();
  } catch (error) {
    if (isAppError(error)) {
      next(error);
      return;
    }

    if (error && typeof error === 'object' && 'code' in (error as Record<string, unknown>)) {
      next(
        createError('auth/unauthorized', '토큰 검증에 실패했습니다.', {
          status: 401,
          hint: '다시 로그인 후 시도해주세요.',
        }),
      );
      return;
    }

    next(error);
  }
}

function getOwnerUid(req: AuthedRequest): string {
  if (!req.ownerUid) {
    throw createError('auth/unauthorized', '로그인이 필요합니다.', { status: 401 });
  }
  return req.ownerUid;
}

async function findPrimaryStore(ownerUid: string): Promise<StoreRecord> {
  try {
    const snapshot = await getDb().collection('stores').where('owner_uid', '==', ownerUid).limit(1).get();
    if (snapshot.empty) {
      throw createError('store/not-found', '스토어 정보를 찾을 수 없습니다.', {
        status: 404,
        hint: '스토어를 먼저 생성해주세요.',
      });
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoreRecord;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw mapFirestoreError('stores/by-owner', error);
  }
}

async function resolveStoreByOwner(ownerUid: string, storeId?: string): Promise<StoreRecord> {
  if (storeId) {
    try {
      const snapshot = await getDb().collection('stores').doc(storeId).get();
      if (!snapshot.exists) {
        throw createError('store/not-found', '스토어 정보를 찾을 수 없습니다.', {
          status: 404,
          hint: 'storeId 값을 다시 확인해주세요.',
        });
      }
      const data = snapshot.data() as Record<string, unknown>;
      if (data.owner_uid !== ownerUid) {
        throw createError('store/unauthorized', '스토어에 대한 권한이 없습니다.', {
          status: 403,
        });
      }
      return { id: snapshot.id, ...data } as StoreRecord;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw mapFirestoreError(`stores/${storeId}`, error);
    }
  }

  return findPrimaryStore(ownerUid);
}

async function loadMenuWithOwnership(menuId: string, ownerUid: string): Promise<MenuRecord> {
  try {
    const snapshot = await getDb().collection('menus').doc(menuId).get();
    if (!snapshot.exists) {
      throw createError('menu/not-found', '메뉴를 찾을 수 없습니다.', {
        status: 404,
        hint: 'menuId 값을 다시 확인해주세요.',
      });
    }

    const data = snapshot.data() as Record<string, unknown>;
    const storeId = typeof data.store_id === 'string' ? data.store_id : '';
    await resolveStoreByOwner(ownerUid, storeId);
    return { id: snapshot.id, ...data } as MenuRecord;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw mapFirestoreError(`menus/${menuId}`, error);
  }
}

function normalizeStorePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    throw createError('store/invalid-payload', '스토어 요청 본문이 올바르지 않습니다.', {
      status: 400,
      hint: 'JSON 객체 형태로 전달해주세요.',
    });
  }

  const data = payload as Record<string, unknown>;
  const name = coerceString(data.name, '');
  const region = coerceString(data.region, '');
  const status = coerceString(data.status, 'open');
  const deliveryRaw = typeof data.delivery === 'object' && data.delivery ? (data.delivery as Record<string, unknown>) : {};
  const ratingRaw = typeof data.rating === 'object' && data.rating ? (data.rating as Record<string, unknown>) : {};

  if (!name || !region) {
    throw createError('store/invalid-payload', '스토어 이름과 지역은 필수입니다.', {
      status: 400,
      hint: 'name, region 값을 확인해주세요.',
    });
  }

  return {
    name,
    region,
    status,
    delivery: {
      available: deliveryRaw.available === true,
      base_fee: coerceNumber(deliveryRaw.base_fee),
      rules: Array.isArray(deliveryRaw.rules) ? deliveryRaw.rules : [],
    },
    rating: {
      score: coerceNumber(ratingRaw.score),
      count: coerceNumber(ratingRaw.count),
    },
  };
}

function normalizeMenuPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    throw createError('menu/invalid-payload', '메뉴 요청 본문이 올바르지 않습니다.', {
      status: 400,
      hint: 'JSON 객체 형태로 전달해주세요.',
    });
  }

  const data = payload as Record<string, unknown>;
  const name = coerceString(data.name, '');
  const currency = coerceString(data.currency, 'KRW');
  const description = typeof data.description === 'string' ? data.description : undefined;
  const price = Number(data.price);
  const stock = Number(data.stock);

  if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) {
    throw createError('menu/invalid-payload', '메뉴 이름, 가격, 재고는 필수입니다.', {
      status: 400,
      hint: 'name, price, stock 값을 확인해주세요.',
    });
  }

  const optionGroups = Array.isArray(data.option_groups) ? data.option_groups : [];
  const images = Array.isArray(data.images) ? data.images.filter((value) => typeof value === 'string') : [];

  const result: Record<string, unknown> = {
    name,
    price,
    currency,
    stock,
    option_groups: optionGroups,
    images,
  };

  if (description !== undefined) {
    result.description = description;
  }

  return result;
}

function serializeStore(data: StoreRecord): Record<string, unknown> {
  const delivery = (data.delivery as Record<string, unknown>) ?? {};
  const rating = (data.rating as Record<string, unknown>) ?? {};

  return {
    id: coerceString(data.id, ''),
    name: coerceString(data.name, ''),
    region: coerceString(data.region, ''),
    status: coerceString(data.status, 'open'),
    delivery: {
      available: delivery.available === true,
      base_fee: coerceNumber(delivery.base_fee),
      rules: Array.isArray(delivery.rules) ? delivery.rules : [],
    },
    rating: {
      score: coerceNumber(rating.score),
      count: coerceNumber(rating.count),
    },
    owner_uid: coerceString(data.owner_uid, ''),
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
  };
}

function serializeMenu(data: MenuRecord): Record<string, unknown> {
  const titleVersion = Number(data.title_v);

  return {
    id: coerceString(data.id, ''),
    store_id: coerceString(data.store_id, ''),
    name: coerceString(data.name, ''),
    price: coerceNumber(data.price),
    currency: coerceString(data.currency, 'KRW'),
    stock: coerceNumber(data.stock),
    option_groups: Array.isArray(data.option_groups) ? data.option_groups : [],
    rating: typeof data.rating === 'object' && data.rating
      ? {
          score: coerceNumber((data.rating as Record<string, unknown>).score),
          count: coerceNumber((data.rating as Record<string, unknown>).count),
        }
      : undefined,
    images: Array.isArray(data.images) ? data.images.filter((value) => typeof value === 'string') : [],
    description: typeof data.description === 'string' ? data.description : undefined,
    title: coerceString(data.title, ''),
    title_v: Number.isFinite(titleVersion) ? titleVersion : undefined,
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
  };
}

function serializeOrder(data: OrderRecord): Record<string, unknown> {
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const timelineRaw = Array.isArray(data.timeline) ? data.timeline : [];

  return {
    id: coerceString(data.id, ''),
    user_id: coerceString(data.user_id, ''),
    status: coerceString(data.status, 'pending'),
    payment_status: coerceString(data.payment_status, ''),
    receipt_id: coerceString(data.receipt_id, ''),
    eta_minutes: coerceNumber(data.eta_minutes),
    items: itemsRaw.map((item) => {
      const record = typeof item === 'object' && item ? (item as Record<string, unknown>) : {};
      const selected = Array.isArray(record.selected_options)
        ? record.selected_options
            .map((entry) => {
              if (typeof entry === 'string') {
                return entry;
              }
              if (entry && typeof entry === 'object') {
                const option = entry as Record<string, unknown>;
                return coerceString(option.label ?? option.id ?? '', '');
              }
              return '';
            })
            .filter((value) => value.length > 0)
        : [];
      const qtyValue = Number(record.quantity ?? record.qty ?? 0);
      const priceValue = Number(record.price ?? 0);
      return {
        menu_id: coerceString(record.menu_id ?? record.menuId, ''),
        name: coerceString(record.name, ''),
        qty: Number.isFinite(qtyValue) ? Number(qtyValue) : 0,
        selected_options: selected,
        price: Number.isFinite(priceValue) ? Number(priceValue) : 0,
      };
    }),
    store_id: coerceString(data.store_id, ''),
    timeline: timelineRaw.map((entry) => {
      const record = typeof entry === 'object' && entry ? (entry as Record<string, unknown>) : {};
      return {
        status: coerceString(record.status, ''),
        at: toIsoString(record.at),
      };
    }),
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
  };
}

async function buildTitlePreviewForStore(store: StoreRecord): Promise<string | undefined> {
  try {
    const snapshot = await getDb().collection('menus').where('store_id', '==', store.id).limit(1).get();
    if (snapshot.empty) {
      return undefined;
    }

    const doc = snapshot.docs[0];
    return buildTitle(doc.data() as Record<string, unknown>, store as Partial<TitleStoreDocument>);
  } catch (error) {
    console.error('Failed to build title preview', error);
    return undefined;
  }
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function coerceNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toIsoString(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
