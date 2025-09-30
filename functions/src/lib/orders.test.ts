import assert from 'node:assert/strict';
import test from 'node:test';
import { MenuDocument, StoreDocument } from './db.js';
import { buildOrderDraft, normalizeOrderRequest, OrderValidationError } from './orders.js';

const NOW = '2024-01-01T00:00:00.000Z';

test('calculates totals including option prices', () => {
  const { items } = normalizeOrderRequest({
    user_id: 'user-1',
    items: [
      {
        menu_id: 'menu-1',
        qty: 2,
        selected_options: [
          { id: 'opt-1', price: 500 },
          { id: 'opt-2', price: 250 },
        ],
      },
    ],
  });

  const store: StoreDocument = {
    id: 'store-1',
    status: 'open',
    delivery: { available: true, base_fee: 2000 },
  };

  const menu: MenuDocument = {
    id: 'menu-1',
    store_id: 'store-1',
    name: '테스트 버거',
    price: 10000,
    currency: 'KRW',
    stock: 10,
  };

  const contexts = new Map([
    ['menu-1', { menu, store }],
  ]);

  const draft = buildOrderDraft({ userId: 'user-1', items, menuContexts: contexts, now: NOW });

  assert.equal(draft.totals.basePrice, 20000);
  assert.equal(draft.totals.optionsPrice, 1500);
  assert.equal(draft.totals.totalPrice, 21500);
  assert.deepEqual(draft.timeline, [{ status: 'pending', at: NOW }]);
  assert.equal(draft.items[0]?.options_price, 1500);
  assert.equal(draft.items[0]?.line_total, 21500);
});

test('throws E01 when stock is insufficient', () => {
  const { items } = normalizeOrderRequest({
    user_id: 'user-1',
    items: [
      { menu_id: 'menu-1', qty: 2 },
    ],
  });

  const store: StoreDocument = {
    id: 'store-1',
    status: 'open',
    delivery: { available: true },
  };

  const menu: MenuDocument = {
    id: 'menu-1',
    store_id: 'store-1',
    name: '테스트 버거',
    price: 10000,
    currency: 'KRW',
    stock: 1,
  };

  const contexts = new Map([
    ['menu-1', { menu, store }],
  ]);

  assert.throws(
    () => {
      buildOrderDraft({ userId: 'user-1', items, menuContexts: contexts, now: NOW });
    },
    (error) => error instanceof OrderValidationError && error.code === 'E01',
  );
});

test('throws E02 when store is closed', () => {
  const { items } = normalizeOrderRequest({
    user_id: 'user-1',
    items: [
      { menu_id: 'menu-1', qty: 1 },
    ],
  });

  const store: StoreDocument = {
    id: 'store-1',
    status: 'closed',
    delivery: { available: true },
  };

  const menu: MenuDocument = {
    id: 'menu-1',
    store_id: 'store-1',
    name: '테스트 버거',
    price: 10000,
    currency: 'KRW',
    stock: 5,
  };

  const contexts = new Map([
    ['menu-1', { menu, store }],
  ]);

  assert.throws(
    () => {
      buildOrderDraft({ userId: 'user-1', items, menuContexts: contexts, now: NOW });
    },
    (error) => error instanceof OrderValidationError && error.code === 'E02',
  );
});

test('throws E03 when delivery is unavailable', () => {
  const { items } = normalizeOrderRequest({
    user_id: 'user-1',
    items: [
      { menu_id: 'menu-1', qty: 1 },
    ],
  });

  const store: StoreDocument = {
    id: 'store-1',
    status: 'open',
    delivery: { available: false },
  };

  const menu: MenuDocument = {
    id: 'menu-1',
    store_id: 'store-1',
    name: '테스트 버거',
    price: 10000,
    currency: 'KRW',
    stock: 5,
  };

  const contexts = new Map([
    ['menu-1', { menu, store }],
  ]);

  assert.throws(
    () => {
      buildOrderDraft({ userId: 'user-1', items, menuContexts: contexts, now: NOW });
    },
    (error) => error instanceof OrderValidationError && error.code === 'E03',
  );
});
