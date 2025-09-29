/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { TextEncoder } from 'node:util';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-test';

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      await setDoc(doc(adminDb, 'stores/store-1'), {
        name: '서울 강남 1호점',
        region: 'seoul',
        status: 'active',
        delivery: { available: true, base_fee: 2500, rules: [] },
        rating: { score: 4.8, count: 120 },
        owner_uid: 'owner-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await setDoc(doc(adminDb, 'stores/store-2'), {
        name: '부산 해운대점',
        region: 'busan',
        status: 'inactive',
        delivery: { available: false, base_fee: 0, rules: [] },
        rating: { score: 4.2, count: 45 },
        owner_uid: 'owner-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await setDoc(doc(adminDb, 'menus/menu-1'), {
        store_id: 'store-1',
        name: '시그니처 버거',
        price: 12000,
        currency: 'KRW',
        stock: 20,
        option_groups: [],
        rating: { score: 4.6, count: 80 },
        images: [],
        description: '대표 메뉴',
        title_v: 'sig-burger',
        title: '시그니처 버거',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    const ownerContext = testEnv.authenticatedContext('owner-1');
    const ownerDb = ownerContext.firestore();

    await assertFails(getDoc(doc(ownerDb, 'stores/store-1')));

    await assertSucceeds(setDoc(doc(ownerDb, 'stores/store-3'), {
      name: '대전 테스트 매장',
      region: 'daejeon',
      status: 'active',
      delivery: { available: true, base_fee: 2000, rules: [] },
      rating: { score: 0, count: 0 },
      owner_uid: 'owner-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await assertFails(updateDoc(doc(ownerDb, 'stores/store-1'), { owner_uid: 'owner-3' }));

    const otherContext = testEnv.authenticatedContext('owner-2');
    const otherDb = otherContext.firestore();
    await assertFails(updateDoc(doc(otherDb, 'stores/store-1'), { status: 'inactive' }));

    await assertSucceeds(setDoc(doc(ownerDb, 'menus/menu-2'), {
      store_id: 'store-1',
      name: '콜라 세트',
      price: 3000,
      currency: 'KRW',
      stock: 50,
      option_groups: [],
      rating: { score: 0, count: 0 },
      images: [],
      description: '콜라 + 감자튀김',
      title_v: 'cola-set',
      title: '콜라 세트',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await assertFails(setDoc(doc(ownerDb, 'menus/menu-3'), {
      store_id: 'store-2',
      name: '타점 메뉴',
      price: 5000,
      currency: 'KRW',
      stock: 10,
      option_groups: [],
      rating: { score: 0, count: 0 },
      images: [],
      description: '다른 매장 메뉴',
      title_v: 'other-menu',
      title: '타점 메뉴',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const storage = ownerContext.storage();
    const allowedRef = ref(storage, 'images/owner-1/sample.txt');
    const encoder = new TextEncoder();
    await assertSucceeds(uploadBytes(allowedRef, encoder.encode('test')));

    const blockedRef = ref(storage, 'images/owner-2/sample.txt');
    await assertFails(uploadBytes(blockedRef, encoder.encode('test')));
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
