import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTitle } from './title.js';

test('combines menu and store fields with hogun marker', () => {
  const title = buildTitle(
    {
      name: '후라이드 치킨',
      price: 18000,
      currency: 'KRW',
      stock: 12,
      rating: { score: 4.5, count: 100 },
    },
    {
      region: 'seoul_gangnam',
      name: '호건치킨',
      status: 'open',
      delivery: { available: true, base_fee: 3000, rules: [] },
    },
  );

  assert.equal(title, 'seoul_gangnam_호건치킨_후라이드-치킨_18000_3000_KRW_4.5_open_12__hogun');
});

test('fills missing fields with deterministic defaults and keeps marker', () => {
  const title = buildTitle(
    {
      name: undefined,
      rating: {},
    },
    {
      delivery: {},
    },
  );

  assert.equal(title, 'unknown-region_unknown-store_unknown-menu_0_0_KRW_0_unknown-status_0__hogun');
});

test('avoids locale specific formatting', () => {
  const title = buildTitle(
    {
      price: 1234.56,
      rating: { score: 4 },
    },
    {},
  );

  assert.ok(title.includes('1234.56'));
  assert.ok(title.endsWith('__hogun'));
});
