/// <reference types="node" />
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

  const storeRef = db.collection('stores').doc('store-1');
  await storeRef.set({
    name: '서울 강남 1호점',
    region: 'seoul',
    status: 'active',
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
  });

  await db.collection('menus').doc('menu-1').set({
    store_id: storeRef.id,
    name: '시그니처 버거 세트',
    price: 12800,
    currency: 'KRW',
    stock: 25,
    option_groups: [
      {
        id: 'drink',
        name: '음료 선택',
        required: true,
        options: [
          { id: 'cola', name: '콜라', price_delta: 0 },
          { id: 'cider', name: '사이다', price_delta: 0 },
        ],
      },
    ],
    rating: { score: 4.7, count: 82 },
    images: ['https://example.com/images/menu-1.png'],
    description: '매일 구운 번과 프리미엄 패티로 만든 대표 메뉴',
    title_v: 'sig-burger-set',
    title: '시그니처 버거 세트',
    created_at: now,
    updated_at: now,
  });

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
    store_id: storeRef.id,
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
