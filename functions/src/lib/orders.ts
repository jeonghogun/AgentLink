import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, MenuDocument, StoreDocument, getDb, mapFirestoreError, searchMenus } from './db.js';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'completed' | 'cancelled';

interface RawOrderItem {
  menu_id?: unknown;
  qty?: unknown;
  selected_options?: unknown;
}

interface RawOrderPayload {
  user_id?: unknown;
  items?: unknown;
}

interface NormalizedOrderItem {
  menuId: string;
  quantity: number;
  selectedOptions: NormalizedOption[];
}

interface NormalizedOption {
  id: string;
  price: number;
  label?: string;
}

interface MenuContext {
  menu: MenuDocument;
  store: StoreDocument;
}

interface OrderDraftItem {
  menu_id: string;
  name: string;
  quantity: number;
  price: number;
  currency: string;
  selected_options: Array<{ id: string; price: number; label?: string }>;
  options_price: number;
  line_total: number;
}

interface OrderDraft {
  store: StoreDocument;
  items: OrderDraftItem[];
  totals: { basePrice: number; optionsPrice: number; totalPrice: number };
  timeline: Array<{ status: OrderStatus; at: string }>;
}

export class OrderValidationError extends Error {
  readonly code: 'E01' | 'E02' | 'E03';
  readonly store: StoreDocument;
  readonly menu?: MenuDocument;

  constructor(code: 'E01' | 'E02' | 'E03', message: string, store: StoreDocument, menu?: MenuDocument) {
    super(message);
    this.code = code;
    this.store = store;
    this.menu = menu;
  }
}

const STATUS_SEQUENCE: Array<{ status: OrderStatus; delayMs: number }> = [
  { status: 'confirmed', delayMs: 10_000 },
  { status: 'preparing', delayMs: 20_000 },
  { status: 'completed', delayMs: 40_000 },
];

const STATUS_RANK: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  completed: 3,
  cancelled: 99,
};

const scheduledOrders = new Set<string>();

export async function createOrder(payload: unknown): Promise<{ order_id: string; status: OrderStatus; payment_status: string }> {
  const { userId, items } = normalizeOrderRequest(payload);
  const uniqueMenuIds = Array.from(new Set(items.map((item) => item.menuId)));
  const menuContexts = await fetchMenuContexts(uniqueMenuIds);

  let draft: OrderDraft;
  try {
    draft = buildOrderDraft({ userId, items, menuContexts });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      await throwOrderApiError(error, menuContexts);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw error;
  }

  const db = getDb();
  const orders = db.collection('orders');
  const orderRef = orders.doc();

  try {
    await orderRef.set({
      user_id: userId,
      store_id: draft.store.id,
      status: 'pending',
      payment_status: 'paid',
      receipt_id: 'demo123',
      eta_minutes: 1,
      options_price: draft.totals.optionsPrice,
      base_price: draft.totals.basePrice,
      total_price: draft.totals.totalPrice,
      items: draft.items,
      timeline: draft.timeline,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    throw mapFirestoreError(`orders/${orderRef.id}`, error);
  }

  scheduleOrderProgression(orderRef.id);

  return { order_id: orderRef.id, status: 'pending', payment_status: 'paid' };
}

export async function getOrderStatus(orderId: string): Promise<{ order_id: string; status: OrderStatus }> {
  const id = typeof orderId === 'string' ? orderId.trim() : '';
  if (!id) {
    throw new ApiError(400, 'order/invalid-id', '주문 ID를 확인해주세요.', '올바른 주문 ID를 전달해주세요.');
  }

  const db = getDb();
  try {
    const snapshot = await db.collection('orders').doc(id).get();
    if (!snapshot.exists) {
      throw new ApiError(404, 'order/not-found', '요청한 주문을 찾을 수 없습니다.', 'order_id 값을 다시 확인해주세요.');
    }

    const data = snapshot.data() ?? {};
    const status = typeof data.status === 'string' ? (data.status as OrderStatus) : 'pending';

    return { order_id: snapshot.id, status };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapFirestoreError(`orders/${id}`, error);
  }
}

export function normalizeOrderRequest(payload: unknown): { userId: string; items: NormalizedOrderItem[] } {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError(400, 'order/invalid-payload', '주문 요청 본문이 올바르지 않습니다.', 'JSON 객체 형태로 전달해주세요.');
  }

  const { user_id: userIdRaw, items: itemsRaw } = payload as RawOrderPayload;
  const userId = typeof userIdRaw === 'string' ? userIdRaw.trim() : '';

  if (!userId) {
    throw new ApiError(400, 'order/invalid-user', 'user_id는 필수 값입니다.', '로그인한 사용자 ID를 전달해주세요.');
  }

  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new ApiError(400, 'order/empty-items', '최소 한 개의 주문 항목을 포함해야 합니다.', 'items 배열을 확인해주세요.');
  }

  const normalized: NormalizedOrderItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') {
      throw new ApiError(400, 'order/invalid-item', '주문 항목 형식이 잘못되었습니다.', 'menu_id와 qty를 포함한 객체 형태여야 합니다.');
    }

    const { menu_id: menuIdRaw, qty, selected_options: selectedOptionsRaw } = entry as RawOrderItem;
    const menuId = typeof menuIdRaw === 'string' ? menuIdRaw.trim() : '';
    const quantity = Number.isFinite(qty) ? Math.floor(Number(qty)) : NaN;

    if (!menuId) {
      throw new ApiError(400, 'order/missing-menu', 'menu_id가 누락되었습니다.', '각 항목에 menu_id를 포함해주세요.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, 'order/invalid-quantity', '수량(qty)은 1 이상의 정수여야 합니다.', '요청 수량을 다시 확인해주세요.');
    }

    const selectedOptions: NormalizedOption[] = [];
    if (Array.isArray(selectedOptionsRaw)) {
      for (const option of selectedOptionsRaw) {
        if (!option || typeof option !== 'object') {
          continue;
        }

        const optionIdRaw = (option as Record<string, unknown>).id;
        const optionLabelRaw = (option as Record<string, unknown>).label ?? (option as Record<string, unknown>).name;
        const optionPriceRaw = (option as Record<string, unknown>).price;

        const optionId = typeof optionIdRaw === 'string' ? optionIdRaw : optionIdRaw != null ? String(optionIdRaw) : '';
        if (!optionId) {
          continue;
        }

        const price = Number.isFinite(optionPriceRaw) ? Number(optionPriceRaw) : Number(optionPriceRaw ?? 0);
        const normalizedOption: NormalizedOption = {
          id: optionId,
          price: Number.isFinite(price) ? Number(price) : 0,
        };

        if (typeof optionLabelRaw === 'string' && optionLabelRaw.trim().length > 0) {
          normalizedOption.label = optionLabelRaw.trim();
        }

        selectedOptions.push(normalizedOption);
      }
    }

    normalized.push({ menuId, quantity, selectedOptions });
  }

  return { userId, items: normalized };
}

export function buildOrderDraft({
  userId,
  items,
  menuContexts,
  now = new Date().toISOString(),
}: {
  userId: string;
  items: NormalizedOrderItem[];
  menuContexts: Map<string, MenuContext>;
  now?: string;
}): OrderDraft {
  if (!userId) {
    throw new ApiError(400, 'order/invalid-user', 'user_id는 필수 값입니다.', '로그인한 사용자 ID를 전달해주세요.');
  }

  if (!items.length) {
    throw new ApiError(400, 'order/empty-items', '최소 한 개의 주문 항목을 포함해야 합니다.', 'items 배열을 확인해주세요.');
  }

  const totalQtyByMenu = new Map<string, number>();
  for (const item of items) {
    totalQtyByMenu.set(item.menuId, (totalQtyByMenu.get(item.menuId) ?? 0) + item.quantity);
  }

  let store: StoreDocument | undefined;
  let baseTotal = 0;
  let optionsTotal = 0;
  const orderItems: OrderDraftItem[] = [];

  for (const item of items) {
    const context = menuContexts.get(item.menuId);
    if (!context) {
      throw new ApiError(404, 'menu/not-found', '요청한 메뉴를 찾을 수 없습니다.', 'menu_id 값을 확인해주세요.');
    }

    if (!store) {
      store = context.store;
      assertStoreAcceptsOrder(store);
    } else if (store.id !== context.store.id) {
      throw new ApiError(
        400,
        'order/multiple-stores',
        '하나의 주문에는 동일 매장의 메뉴만 포함할 수 있습니다.',
        '매장별로 주문을 분리해주세요.',
      );
    }

    const requiredQty = totalQtyByMenu.get(item.menuId) ?? item.quantity;
    assertStockAvailable(context.menu, context.store, requiredQty);

    const unitPrice = Number(context.menu.price) || 0;
    const optionsPerUnit = item.selectedOptions.reduce((sum, option) => sum + option.price, 0);
    const lineBase = unitPrice * item.quantity;
    const lineOptions = optionsPerUnit * item.quantity;
    const lineTotal = lineBase + lineOptions;

    baseTotal += lineBase;
    optionsTotal += lineOptions;

    orderItems.push({
      menu_id: context.menu.id,
      name: context.menu.name ?? context.menu.title ?? '',
      quantity: item.quantity,
      price: unitPrice,
      currency: context.menu.currency ?? 'KRW',
      selected_options: item.selectedOptions.map((option) => ({ id: option.id, price: option.price, label: option.label })),
      options_price: lineOptions,
      line_total: lineTotal,
    });
  }

  if (!store) {
    throw new ApiError(500, 'order/missing-store', '주문 매장 정보를 확인할 수 없습니다.');
  }

  return {
    store,
    items: orderItems,
    totals: {
      basePrice: baseTotal,
      optionsPrice: optionsTotal,
      totalPrice: baseTotal + optionsTotal,
    },
    timeline: [{ status: 'pending', at: now }],
  };
}

function assertStoreAcceptsOrder(store: StoreDocument): void {
  const status = typeof store.status === 'string' ? store.status.toLowerCase() : '';
  if (status !== 'open') {
    throw new OrderValidationError('E02', '마감', store);
  }

  const deliveryAvailable = store.delivery?.available === true;
  if (!deliveryAvailable) {
    throw new OrderValidationError('E03', '배달 불가', store);
  }
}

function assertStockAvailable(menu: MenuDocument, store: StoreDocument, requiredQty: number): void {
  const stock = menu.stock;
  if (typeof stock === 'number' && stock < requiredQty) {
    throw new OrderValidationError('E01', '품절', store, menu);
  }

  if (typeof stock === 'string') {
    const normalized = stock.toLowerCase();
    if (normalized === 'out_of_stock' || normalized === 'out-of-stock') {
      throw new OrderValidationError('E01', '품절', store, menu);
    }
  }
}

async function fetchMenuContexts(menuIds: string[]): Promise<Map<string, MenuContext>> {
  const db = getDb();

  try {
    const menuSnapshots = await Promise.all(menuIds.map((id) => db.collection('menus').doc(id).get()));
    const storeIds = new Set<string>();
    const pending = new Map<string, { menu: MenuDocument; storeId: string }>();

    for (const snapshot of menuSnapshots) {
      if (!snapshot.exists) {
        throw new ApiError(404, 'menu/not-found', '요청한 메뉴를 찾을 수 없습니다.', 'menu_id 값을 확인해주세요.');
      }

      const data = snapshot.data() as Record<string, unknown>;
      const storeId = typeof data.store_id === 'string' ? data.store_id : '';
      if (!storeId) {
        throw new ApiError(500, 'menu/missing-store', '메뉴에 연결된 매장 정보가 없습니다.', '데이터 시드를 확인해주세요.');
      }

      storeIds.add(storeId);
      const menu = { id: snapshot.id, ...(data as Record<string, unknown>) } as MenuDocument;
      pending.set(snapshot.id, { menu, storeId });
    }

    const storeSnapshots = await Promise.all(Array.from(storeIds).map((id) => db.collection('stores').doc(id).get()));
    const stores = new Map<string, StoreDocument>();
    for (const snapshot of storeSnapshots) {
      if (!snapshot.exists) {
        throw new ApiError(404, 'store/not-found', '연결된 매장 정보를 찾을 수 없습니다.', 'store 문서를 확인해주세요.');
      }
      stores.set(snapshot.id, { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as StoreDocument);
    }

    const contexts = new Map<string, MenuContext>();
    for (const [menuId, info] of pending) {
      const store = stores.get(info.storeId);
      if (!store) {
        throw new ApiError(404, 'store/not-found', '연결된 매장 정보를 찾을 수 없습니다.', 'store 문서를 확인해주세요.');
      }

      contexts.set(menuId, { menu: info.menu, store });
    }

    return contexts;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw mapFirestoreError('orders/load-menus', error);
  }
}

async function throwOrderApiError(error: OrderValidationError, menuContexts: Map<string, MenuContext>): Promise<never> {
  const excludeMenuIds = new Set<string>();
  for (const key of menuContexts.keys()) {
    excludeMenuIds.add(key);
  }
  if (error.menu) {
    excludeMenuIds.add(error.menu.id);
  }

  const alternatives = await suggestAlternatives(error.store, excludeMenuIds);
  throw new ApiError(409, error.code, error.message, undefined, { alternatives });
}

async function suggestAlternatives(store: StoreDocument, excludeMenuIds: Set<string>): Promise<string[]> {
  try {
    const results = await searchMenus({ region: store.region, limit: 8 });
    const ids = results
      .map((entry) => entry.menu.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && !excludeMenuIds.has(id));

    if (ids.length > 0) {
      return ids.slice(0, 3);
    }
  } catch (error) {
    console.error('Failed to fetch alternative menus', error);
  }

  return [];
}

function scheduleOrderProgression(orderId: string): void {
  if (scheduledOrders.has(orderId)) {
    return;
  }

  scheduledOrders.add(orderId);
  STATUS_SEQUENCE.forEach((step, index) => {
    setTimeout(() => {
      advanceOrderStatus(orderId, step.status)
        .catch((error) => {
          console.error(`Failed to update order ${orderId} to ${step.status}`, error);
        })
        .finally(() => {
          if (index === STATUS_SEQUENCE.length - 1) {
            scheduledOrders.delete(orderId);
          }
        });
    }, step.delayMs);
  });
}

async function advanceOrderStatus(orderId: string, targetStatus: OrderStatus): Promise<void> {
  const db = getDb();
  const ref = db.collection('orders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() ?? {};
    const currentStatusRaw = data.status;
    const currentStatus = typeof currentStatusRaw === 'string' ? (currentStatusRaw as OrderStatus) : 'pending';

    if (currentStatus === 'cancelled') {
      return;
    }

    const currentRank = STATUS_RANK[currentStatus] ?? -1;
    const targetRank = STATUS_RANK[targetStatus] ?? -1;

    if (targetRank <= currentRank) {
      return;
    }

    const timeline = Array.isArray(data.timeline) ? [...(data.timeline as Array<{ status: string; at: string }>)] : [];
    timeline.push({ status: targetStatus, at: new Date().toISOString() });

    tx.update(ref, {
      status: targetStatus,
      updated_at: FieldValue.serverTimestamp(),
      timeline,
    });
  });
}
