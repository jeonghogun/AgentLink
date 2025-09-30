import { test, expect } from '@playwright/test';

test.describe('대시보드 메뉴 흐름', () => {
  test.beforeEach(async ({ page }) => {
    const store = {
      id: 'store-1',
      name: '테스트 매장',
      region: 'seoul_gangnam',
      status: 'open',
      delivery: { available: true, base_fee: 2500, rules: [] },
      rating: { score: 4.5, count: 100 },
      owner_uid: 'test-owner',
    };

    const menus = new Map<string, ReturnType<typeof createMenu>>([
      [
        'menu-1',
        createMenu({
          id: 'menu-1',
          name: '기존 메뉴',
          price: 12000,
          stock: 12,
        }),
      ],
    ]);

    const buildTitles = () => Array.from(menus.values()).map((menu) => menu.title);

    await page.route('**/api/dashboard/store', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ store }),
        });
        return;
      }

      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() ?? '{}');
        store.name = payload.name;
        store.region = payload.region;
        store.status = payload.status;
        store.delivery = payload.delivery;
        store.rating = payload.rating;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ store, title_preview: `${store.region}_${store.name}__hogun` }),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/dashboard/menus?**', async (route) => {
      const response = {
        menus: Array.from(menus.values()),
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });

    await page.route('**/api/dashboard/stores/store-1/menus', async (route) => {
      const payload = JSON.parse(route.request().postData() ?? '{}');
      const menu = createMenu({
        id: `menu-${menus.size + 1}`,
        name: payload.name,
        price: payload.price,
        stock: payload.stock,
        currency: payload.currency,
        option_groups: payload.option_groups,
        images: payload.images,
        description: payload.description,
      });
      menus.set(menu.id, menu);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ menu }) });
    });

    await page.route('**/api/dashboard/menus/*', async (route) => {
      const url = new URL(route.request().url());
      const menuId = url.pathname.split('/').pop() ?? '';
      if (route.request().method() === 'PUT') {
        const payload = JSON.parse(route.request().postData() ?? '{}');
        const existing = menus.get(menuId);
        if (existing) {
          const updated = createMenu({
            id: existing.id,
            name: payload.name,
            price: payload.price,
            stock: payload.stock,
            currency: payload.currency,
            option_groups: payload.option_groups,
            images: payload.images,
            description: payload.description,
          });
          menus.set(menuId, updated);
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ menu: updated }) });
          return;
        }
      }

      if (route.request().method() === 'DELETE') {
        menus.delete(menuId);
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not-found', message: '메뉴를 찾을 수 없습니다.' }) });
    });

    await page.route('**/api/search?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ titles: buildTitles() }),
      });
    });
  });

  test('로그인 후 메뉴 생성과 타이틀 토스트 확인', async ({ page }) => {
    await page.goto('/dashboard/menus');

    await expect(page.getByText('기존 메뉴')).toBeVisible();

    await page.getByRole('button', { name: '새 메뉴 추가' }).click();
    await page.getByLabel('메뉴명').fill('플레이 테스트 메뉴');
    await page.getByLabel('가격').fill('15000');
    await page.getByLabel('재고').fill('5');
    await page.getByLabel('설명').fill('플레이라이트 자동화 테스트용 메뉴');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('메뉴가 저장되었습니다. 새 타이틀:')).toBeVisible();
    await expect(page.getByText('플레이 테스트 메뉴')).toBeVisible();
  });
});

function createMenu({
  id,
  name,
  price,
  stock,
  currency = 'KRW',
  option_groups = [],
  images = [],
  description = '',
}: {
  id: string;
  name: string;
  price: number;
  stock: number;
  currency?: string;
  option_groups?: unknown[];
  images?: string[];
  description?: string;
}) {
  const title = `${name}_${price}_${stock}__hogun`;
  return {
    id,
    store_id: 'store-1',
    name,
    price,
    currency,
    stock,
    option_groups,
    images,
    description,
    rating: { score: 4.5, count: 100 },
    title,
  };
}
