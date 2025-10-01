import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import supertest from 'supertest';
import express from 'express';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { apiApp } from '../../functions/src/api/index.js';
import { aiHandler } from '../../functions/src/ai/index.js';
import { getDb } from '../../functions/src/lib/db.js';
import { seedData } from '../../scripts/seed-data.js';

const request = supertest(apiApp);
const aiApp = express();
aiApp.all('*', (req, res) => {
  void aiHandler(req as unknown as Parameters<typeof aiHandler>[0], res);
});
const aiRequest = supertest(aiApp);

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-project';

test.describe('API 통합 시나리오', { timeout: 180_000, concurrency: false }, () => {
  test.before(async () => {
    await seedData({ projectId: PROJECT_ID });
  });

  test('검색 시 50개의 __hogun 타이틀 반환', async () => {
    const response = await request.get('/api/search').query({ limit: 50, region: 'seoul_gangnam' });
    assert.equal(response.status, 200);
    const titles = response.body.titles as string[];
    assert.equal(titles.length, 50);
    for (const title of titles) {
      assert.ok(title.endsWith('__hogun'), `title ${title} should end with __hogun`);
    }
  });

  test('메뉴 상세에 옵션/설명/규칙 포함', async () => {
    const response = await request.get('/api/menu/menu-alpha-1');
    assert.equal(response.status, 200);
    const content = response.body.content;
    assert.ok(Array.isArray(content.option_groups));
    assert.equal(typeof content.description, 'string');
    assert.ok(Array.isArray(content.delivery.rules));
  });

  test('주문 생성 시 서버에서 총액 계산', async () => {
    const orderPayload = {
      user_id: 'qa-user',
      items: [
        {
          menu_id: 'menu-dashboard-1',
          qty: 2,
          selected_options: [
            { id: 'regular', price: 0 },
            { id: 'large', price: 1500 },
          ],
        },
      ],
    };

    const response = await request.post('/api/order').send(orderPayload);
    assert.equal(response.status, 201);
    const orderId = response.body.order_id as string;
    assert.ok(orderId);

    const snapshot = await getDb().collection('orders').doc(orderId).get();
    assert.ok(snapshot.exists);
    const data = snapshot.data() ?? {};
    assert.equal(data.base_price, 13800 * 2);
    assert.equal(data.options_price, 1500 * 2);
    assert.equal(data.total_price, 13800 * 2 + 1500 * 2);
  });

  test('주문 상태가 pending → confirmed → preparing → completed 로 전환', async () => {
    const response = await request.post('/api/order').send({
      user_id: 'qa-status-user',
      items: [
        {
          menu_id: 'menu-dashboard-2',
          qty: 1,
          selected_options: [{ id: 'regular', price: 0 }],
        },
      ],
    });
    assert.equal(response.status, 201);
    const orderId = response.body.order_id as string;

    const observed = new Set<string>();
    const deadline = Date.now() + 70_000;
    let finalStatus = '';
    while (Date.now() < deadline) {
      const statusRes = await request.get(`/api/order/${orderId}/status`);
      assert.equal(statusRes.status, 200);
      const status = statusRes.body.status as string;
      observed.add(status);
      finalStatus = status;
      if (status === 'completed') {
        break;
      }
      await delay(5_000);
    }

    assert.ok(observed.has('pending'));
    assert.ok(observed.has('confirmed'));
    assert.ok(observed.has('preparing'));
    assert.equal(finalStatus, 'completed');
  });

  test('E01 품절 오류가 대체 메뉴와 함께 반환', async () => {
    const response = await request.post('/api/order').send({
      user_id: 'qa-error-user',
      items: [{ menu_id: 'menu-dashboard-soldout', qty: 1, selected_options: [] }],
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'E01');
    assert.ok(Array.isArray(response.body.alternatives));
  });

  test('E02 마감 오류가 대체 메뉴와 함께 반환', async () => {
    const response = await request.post('/api/order').send({
      user_id: 'qa-error-user',
      items: [{ menu_id: 'menu-closed-1', qty: 1, selected_options: [] }],
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'E02');
    assert.ok(Array.isArray(response.body.alternatives));
  });

  test('E03 배달 불가 오류가 대체 메뉴와 함께 반환', async () => {
    const response = await request.post('/api/order').send({
      user_id: 'qa-error-user',
      items: [{ menu_id: 'menu-no-delivery-1', qty: 1, selected_options: [] }],
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'E03');
    assert.ok(Array.isArray(response.body.alternatives));
  });

  test('오케스트레이션 성공 시 요약 반환', async () => {
    const response = await request.post('/api/orchestrate').send({
      region: 'seoul_gangnam',
      keyword: '추천',
      preferences: { price_weight: 0.4, rating_weight: 0.3, fee_weight: 0.3 },
    });
    assert.equal(response.status, 200);
    const body = response.body;
    assert.equal(typeof body.store, 'string');
    assert.equal(typeof body.menu, 'string');
    assert.ok(Array.isArray(body.summary));
    assert.ok(body.summary.length >= 2);
  });

  test('오케스트레이션 실패 시 모의 응답으로 폴백', async () => {
    const response = await request.post('/api/orchestrate').send({
      region: 'seoul_gangnam',
      keyword: '존재하지않는키워드',
    });
    assert.equal(response.status, 200);
    assert.ok(typeof response.body.menu === 'string');
    assert.ok(String(response.body.menu).includes('모의'));
  });

  test('AI 인덱스 엔드포인트 정상 응답', async () => {
    const indexResponse = await aiRequest.get('/ai/index.json');
    assert.equal(indexResponse.status, 200);
    assert.ok(Array.isArray(indexResponse.body.stores));
    const storeEntry = indexResponse.body.stores.find((entry: { store_id: string }) => entry.store_id === 'store-dashboard');
    assert.ok(storeEntry);

    const storeResponse = await aiRequest.get('/ai/store/store-dashboard.json');
    assert.equal(storeResponse.status, 200);
    assert.ok(Array.isArray(storeResponse.body.menus));
    assert.ok(storeResponse.body.menus.length > 0);
  });

  test('메트릭 요약이 토큰 절감 수치를 포함', async () => {
    await request.get('/api/search').query({ limit: 10 });
    const response = await request.get('/api/metrics');
    assert.equal(response.status, 200);
    const apiMetrics = response.body.api['/api/search'];
    assert.ok(apiMetrics);
    assert.ok(apiMetrics.count >= 1);
    const tokenSavings = response.body.token_savings;
    assert.ok(tokenSavings);
    assert.ok(tokenSavings.savings_percent > 0);
  });

  test('Rate limit가 429 응답을 반환', async () => {
    const ip = '203.0.113.77';
    for (let i = 0; i < 60; i += 1) {
      const res = await request.get('/api/health').set('x-forwarded-for', ip);
      assert.equal(res.status, 200);
    }
    const blocked = await request.get('/api/health').set('x-forwarded-for', ip);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, 'rate-limit/exceeded');
  });

  test('허용되지 않은 Origin은 403', async () => {
    const response = await request.get('/api/health').set('Origin', 'https://malicious.example.com');
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'cors/not-allowed');
  });

  test('Firestore 규칙이 비인증 접근을 차단', async () => {
    const env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { host: '127.0.0.1', port: 8080 },
    });

    try {
      await assertFails(env.unauthenticatedContext().firestore().collection('stores').get());
    } finally {
      await env.cleanup();
    }
  });

  test('모의 orchestrate 엔드포인트 직접 호출', async () => {
    const response = await request.post('/api/mock/orchestrate');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.summary));
    assert.ok(String(response.body.menu).includes('모의'));
  });
});

