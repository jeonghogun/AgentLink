import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { buildTitle } from '../functions/src/lib/title.js';

export interface SeedOptions {
  projectId?: string;
}

export async function seedData(options: SeedOptions = {}): Promise<void> {
  const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID ?? 'demo-project';

  ensureEmulatorEnv();
  if (!getApps().length) {
    initializeApp({ projectId });
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  await clearCollections(db, ['stores', 'menus', 'orders', 'api_keys', 'metrics', 'settings']);

  const now = Timestamp.now();
  const stores = buildStores(now);
  for (const entry of stores) {
    await db.collection('stores').doc(entry.id).set(entry.data);
  }

  const storeLookup = new Map(stores.map((store) => [store.id, store.data]));
  const menus = buildMenus(now, storeLookup);
  for (const menu of menus) {
    const store = storeLookup.get(menu.storeId);
    if (!store) {
      continue;
    }

    const title = buildTitle(
      {
        name: menu.data.name,
        price: menu.data.price,
        currency: menu.data.currency,
        stock: menu.data.stock,
        option_groups: menu.data.option_groups,
        rating: menu.data.rating,
        description: menu.data.description,
      },
      store,
    );

    await db
      .collection('menus')
      .doc(menu.id)
      .set({
        ...menu.data,
        store_id: menu.storeId,
        title,
        title_v: 1,
      });
  }

  await createSeedOrders(db, now);
  await createSeedMetrics(db, now);
  await db.collection('settings').doc('runtime').set({
    x_marker: now.toDate().toISOString(),
    weights: { price: 0.3, rating: 0.5, fee: 0.2 },
  });
}

function ensureEmulatorEnv(): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  }
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  }
}

async function clearCollections(db: Firestore, paths: string[]): Promise<void> {
  for (const path of paths) {
    const snapshot = await db.collection(path).get();
    if (snapshot.empty) {
      continue;
    }

    let batch = db.batch();
    let counter = 0;
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      counter += 1;
      if (counter >= 400) {
        await batch.commit();
        batch = db.batch();
        counter = 0;
      }
    }

    if (counter > 0) {
      await batch.commit();
    }
  }
}

function buildStores(now: Timestamp): Array<{ id: string; data: Record<string, unknown> }> {
  return [
    {
      id: 'store-dashboard',
      data: {
        name: '테스트 오너 매장',
        region: 'seoul_gangnam',
        status: 'open',
        delivery: { available: true, base_fee: 2000, rules: [{ type: 'free-delivery', min_amount: 40000 }] },
        rating: { score: 4.7, count: 320 },
        owner_uid: 'test-owner',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-alpha',
      data: {
        name: '서울 알파 매장',
        region: 'seoul_gangnam',
        status: 'open',
        delivery: { available: true, base_fee: 2500, rules: [{ type: 'surcharge', region: 'seocho', fee: 1000 }] },
        rating: { score: 4.8, count: 210 },
        owner_uid: 'owner-alpha',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-beta',
      data: {
        name: '부산 베타 매장',
        region: 'busan_haeundae',
        status: 'open',
        delivery: { available: true, base_fee: 3200, rules: [{ type: 'zone-fee', region: 'ulsan', fee: 1500 }] },
        rating: { score: 4.5, count: 160 },
        owner_uid: 'owner-beta',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-closed',
      data: {
        name: '휴무 치킨',
        region: 'seoul_gangnam',
        status: 'closed',
        delivery: { available: true, base_fee: 2400, rules: [] },
        rating: { score: 4.2, count: 90 },
        owner_uid: 'owner-closed',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-no-delivery',
      data: {
        name: '포장 전문점',
        region: 'seoul_gangnam',
        status: 'open',
        delivery: { available: false, base_fee: 0, rules: [] },
        rating: { score: 4.3, count: 75 },
        owner_uid: 'owner-nodelivery',
        created_at: now,
        updated_at: now,
      },
    },
  ];
}

function buildMenus(
  now: Timestamp,
  storeLookup: Map<string, Record<string, unknown>>,
): Array<{ id: string; storeId: string; data: Record<string, unknown> }> {
  const menus: Array<{ id: string; storeId: string; data: Record<string, unknown> }> = [];
  const baseOptionGroups = [
    {
      id: 'size',
      name: '사이즈',
      type: 'single_choice',
      options: [
        { id: 'regular', name: '보통', price: 0 },
        { id: 'large', name: '대', price: 1500 },
      ],
    },
  ];

  menus.push(
    ...[
      {
        id: 'menu-dashboard-1',
        storeId: 'store-dashboard',
        data: {
          name: '운영자 버거 세트',
          price: 13800,
          currency: 'KRW',
          stock: 18,
          rating: { score: 4.8, count: 180 },
          option_groups: baseOptionGroups,
          images: [],
          description: '테스트 오너를 위한 대표 메뉴 세트',
          created_at: now,
          updated_at: now,
        },
      },
      {
        id: 'menu-dashboard-2',
        storeId: 'store-dashboard',
        data: {
          name: '시그니처 마라 치킨',
          price: 15900,
          currency: 'KRW',
          stock: 22,
          rating: { score: 4.6, count: 95 },
          option_groups: baseOptionGroups,
          images: [],
          description: '마라 소스로 시그니처 풍미를 더한 치킨 메뉴',
          created_at: now,
          updated_at: now,
        },
      },
      {
        id: 'menu-dashboard-soldout',
        storeId: 'store-dashboard',
        data: {
          name: '품절 전용 메뉴',
          price: 11000,
          currency: 'KRW',
          stock: 0,
          rating: { score: 4.1, count: 40 },
          option_groups: baseOptionGroups,
          images: [],
          description: '품절 테스트용 메뉴',
          created_at: now,
          updated_at: now,
        },
      },
    ],
  );

  menus.push({
    id: 'menu-closed-1',
    storeId: 'store-closed',
    data: {
      name: '휴무 특선 메뉴',
      price: 14500,
      currency: 'KRW',
      stock: 12,
      rating: { score: 4.0, count: 20 },
      option_groups: baseOptionGroups,
      images: [],
      description: '영업 종료 상태 테스트 메뉴',
      created_at: now,
      updated_at: now,
    },
  });

  menus.push({
    id: 'menu-no-delivery-1',
    storeId: 'store-no-delivery',
    data: {
      name: '포장 전용 메뉴',
      price: 13200,
      currency: 'KRW',
      stock: 16,
      rating: { score: 4.2, count: 33 },
      option_groups: baseOptionGroups,
      images: [],
      description: '배달 불가 테스트 메뉴',
      created_at: now,
      updated_at: now,
    },
  });

  for (let index = 1; index <= 60; index += 1) {
    menus.push({
      id: `menu-alpha-${index}`,
      storeId: 'store-alpha',
      data: {
        name: `서울 추천 메뉴 ${index}`,
        price: 11800 + index * 45,
        currency: 'KRW',
        stock: 15 + (index % 5),
        rating: { score: 4.2 + ((index % 5) * 0.1), count: 120 + index },
        option_groups: baseOptionGroups,
        images: [],
        description: `서울 알파 매장의 추천 메뉴 ${index}`,
        created_at: now,
        updated_at: now,
      },
    });
  }

  menus.push({
    id: 'menu-beta-1',
    storeId: 'store-beta',
    data: {
      name: '부산 베스트 버거',
      price: 14200,
      currency: 'KRW',
      stock: 18,
      rating: { score: 4.5, count: 110 },
      option_groups: baseOptionGroups,
      images: [],
      description: '해운대 인기 버거 메뉴',
      created_at: now,
      updated_at: now,
    },
  });

  menus.push({
    id: 'menu-beta-2',
    storeId: 'store-beta',
    data: {
      name: '부산 스페셜 세트',
      price: 16600,
      currency: 'KRW',
      stock: 20,
      rating: { score: 4.7, count: 95 },
      option_groups: baseOptionGroups,
      images: [],
      description: '부산 현지 특산 소스를 활용한 세트',
      created_at: now,
      updated_at: now,
    },
  });

  return menus;
}

async function createSeedOrders(db: Firestore, now: Timestamp): Promise<void> {
  await db.collection('orders').doc('order-sample').set({
    user_id: 'user-sample',
    store_id: 'store-dashboard',
    status: 'preparing',
    payment_status: 'paid',
    receipt_id: 'SAMPLE-001',
    eta_minutes: 30,
    base_price: 27600,
    options_price: 3000,
    total_price: 30600,
    items: [
      {
        menu_id: 'menu-dashboard-1',
        name: '운영자 버거 세트',
        quantity: 2,
        price: 13800,
        currency: 'KRW',
        options_price: 3000,
        line_total: 30600,
        selected_options: [
          { id: 'regular', price: 0, label: '보통' },
          { id: 'large', price: 1500, label: '대' },
        ],
      },
    ],
    timeline: [
      { status: 'pending', at: now.toDate().toISOString() },
      { status: 'confirmed', at: now.toDate().toISOString() },
      { status: 'preparing', at: now.toDate().toISOString() },
    ],
    created_at: now,
    updated_at: now,
  });
}

async function createSeedMetrics(db: Firestore, now: Timestamp): Promise<void> {
  const shard = now.toDate().toISOString().slice(0, 10);
  await db.collection('metrics').doc(shard).set({
    api: {
      '/api/search': { count: 12, avg_ms: 85, fail: 0 },
      '/api/menu/:id': { count: 6, avg_ms: 42, fail: 0 },
    },
    token_savings: {
      latest: {
        optimized_tokens: 120,
        baseline_tokens: 360,
        savings_ratio: 0.6667,
        savings_percent: 66.67,
        captured_at: now.toDate().toISOString(),
      },
    },
  });
}

