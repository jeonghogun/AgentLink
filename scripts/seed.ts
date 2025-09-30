/// <reference types="node" />
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildTitle } from '../functions/src/lib/title.js';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-project';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
}

initializeApp({ projectId });

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function seed() {
  const now = Timestamp.now();

  const stores = [
    {
      id: 'store-1',
      data: {
        name: '서울 강남 1호점',
        region: 'seoul_gangnam',
        status: 'open',
        delivery: {
          available: true,
          base_fee: 2500,
          rules: [
            { type: 'free-delivery', min_amount: 50000 },
            { type: 'surcharge', region: 'gyeonggi', fee: 1000 },
          ],
        },
        rating: { score: 4.8, count: 120 },
        owner_uid: 'owner-1',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-2',
      data: {
        name: '부산 해운대 1호점',
        region: 'busan_haeundae',
        status: 'open',
        delivery: {
          available: true,
          base_fee: 3500,
          rules: [{ type: 'zone-fee', region: 'ulsan', fee: 1500 }],
        },
        rating: { score: 4.6, count: 90 },
        owner_uid: 'owner-2',
        created_at: now,
        updated_at: now,
      },
    },
    {
      id: 'store-3',
      data: {
        name: '대구 수성 1호점',
        region: 'daegu_suseong',
        status: 'paused',
        delivery: {
          available: false,
          base_fee: 0,
          rules: [],
        },
        rating: { score: 4.2, count: 58 },
        owner_uid: 'owner-3',
        created_at: now,
        updated_at: now,
      },
    },
  ];

  for (const store of stores) {
    await db.collection('stores').doc(store.id).set(store.data);
  }

  const menus = [
    {
      id: 'menu-1',
      storeId: 'store-1',
      name: '시그니처 버거 세트',
      price: 12800,
      currency: 'KRW',
      stock: 25,
      rating: { score: 4.7, count: 82 },
    },
    {
      id: 'menu-2',
      storeId: 'store-1',
      name: '바삭 치킨 샐러드',
      price: 9800,
      currency: 'KRW',
      stock: 18,
      rating: { score: 4.2, count: 40 },
    },
    {
      id: 'menu-3',
      storeId: 'store-1',
      name: '스파이시 치킨 버거',
      price: 11500,
      currency: 'KRW',
      stock: 30,
      rating: { score: 4.4, count: 55 },
    },
    {
      id: 'menu-4',
      storeId: 'store-1',
      name: '더블 치즈 버거',
      price: 13500,
      currency: 'KRW',
      stock: 20,
      rating: { score: 4.9, count: 120 },
    },
    {
      id: 'menu-5',
      storeId: 'store-2',
      name: '부산 갈릭 새우 버거',
      price: 14200,
      currency: 'KRW',
      stock: 28,
      rating: { score: 4.8, count: 73 },
    },
    {
      id: 'menu-6',
      storeId: 'store-2',
      name: '해운대 피시 버거',
      price: 13200,
      currency: 'KRW',
      stock: 22,
      rating: { score: 4.4, count: 61 },
    },
    {
      id: 'menu-7',
      storeId: 'store-2',
      name: '크리스피 쉬림프 세트',
      price: 15800,
      currency: 'KRW',
      stock: 16,
      rating: { score: 4.6, count: 88 },
    },
    {
      id: 'menu-8',
      storeId: 'store-2',
      name: '부산 바다 세트',
      price: 16800,
      currency: 'KRW',
      stock: 14,
      rating: { score: 4.3, count: 47 },
    },
    {
      id: 'menu-9',
      storeId: 'store-3',
      name: '대구 매운 닭강정',
      price: 15000,
      currency: 'KRW',
      stock: 0,
      rating: { score: 4.1, count: 95 },
    },
    {
      id: 'menu-10',
      storeId: 'store-3',
      name: '수성 통닭 세트',
      price: 17800,
      currency: 'KRW',
      stock: 10,
      rating: { score: 4.0, count: 35 },
    },
    {
      id: 'menu-11',
      storeId: 'store-3',
      name: '매콤 불닭 버거',
      price: 16500,
      currency: 'KRW',
      stock: 12,
      rating: { score: 3.9, count: 28 },
    },
    {
      id: 'menu-12',
      storeId: 'store-3',
      name: '갈릭 허브 치킨',
      price: 15500,
      currency: 'KRW',
      stock: 8,
      rating: { score: 4.3, count: 66 },
    },
  ];

  const storeLookup = new Map(stores.map((entry) => [entry.id, entry.data]));

  for (const menu of menus) {
    const store = storeLookup.get(menu.storeId);
    const menuDoc = {
      store_id: menu.storeId,
      name: menu.name,
      price: menu.price,
      currency: menu.currency,
      stock: menu.stock,
      rating: menu.rating,
      option_groups: [],
      images: [],
      description: `${menu.name} 기본 구성`,
      created_at: now,
      updated_at: now,
    };

    const title = buildTitle(menuDoc, store);

    await db.collection('menus').doc(menu.id).set({
      ...menuDoc,
      title,
      title_v: 1,
    });
  }

  await db.collection('orders').doc('order-1').set({
    user_id: 'user-1',
    items: [
      {
        menu_id: 'menu-1',
        name: '시그니처 버거 세트',
        quantity: 2,
        price: 12800,
        options: [
          { group_id: 'drink', option_id: 'cola' },
        ],
      },
    ],
    status: 'preparing',
    payment_status: 'paid',
    receipt_id: 'RCP-20240301-0001',
    eta_minutes: 25,
    timeline: [
      { status: 'pending', at: now.toDate().toISOString() },
      { status: 'paid', at: now.toDate().toISOString() },
    ],
    store_id: stores[0].id,
    created_at: now,
    updated_at: now,
  });

  await db.collection('api_keys').doc('client-1').set({
    name: '내부 검색 서비스',
    key_hash: 'hash-of-key',
    role: 'search-service',
    created_at: now,
  });

  await db.collection('metrics').doc('2024-03-01').set({
    api: {
      '/api/search': { count: 1520, avg_ms: 82, fail: 12 },
      '/api/stores': { count: 980, avg_ms: 45, fail: 3 },
    },
  });

  await db.collection('settings').doc('runtime').set({
    x_marker: '2024-03-01T09:00:00+09:00',
    weights: {
      price: 0.3,
      rating: 0.5,
      fee: 0.2,
    },
  });

  console.info(`Seed data inserted into project ${projectId}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed Firestore data', error);
    process.exit(1);
  });
