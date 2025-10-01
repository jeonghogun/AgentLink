import { test, expect } from '@playwright/test';

test.describe('대시보드 실동작 시나리오', () => {
  test('스토어, 메뉴, 주문 관리 플로우', async ({ page }) => {
    // 스토어 정보 업데이트 및 영업 토글
    await page.goto('/dashboard/store');
    await expect(page.getByRole('heading', { name: '스토어 정보' })).toBeVisible();

    const updatedStoreName = `테스트 오너 매장 QA ${Date.now() % 1000}`;
    await page.getByLabel('상호명').fill(updatedStoreName);
    await page.getByLabel('배달 기본 요금').fill('2500');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('새로운 타이틀:')).toBeVisible();

    await page.getByRole('button', { name: '영업 종료' }).click();
    await expect(page.getByText('새로운 타이틀:')).toBeVisible();
    await page.getByRole('button', { name: '영업 시작' }).click();
    await expect(page.getByText('새로운 타이틀:')).toBeVisible();

    // 메뉴 생성/품절/삭제 플로우
    await page.goto('/dashboard/menus');
    await expect(page.getByRole('heading', { name: '메뉴 관리' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '운영자 버거 세트' })).toBeVisible();

    const menuName = `QA 자동화 메뉴 ${Date.now()}`;
    await page.getByRole('button', { name: '새 메뉴 추가' }).click();
    await page.getByLabel('메뉴명').fill(menuName);
    await page.getByLabel('가격').fill('12345');
    await page.getByLabel('통화').fill('KRW');
    await page.getByLabel('재고').fill('5');
    await page.getByLabel('설명').fill('QA 자동화 시나리오 검증용 메뉴');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('메뉴가 저장되었습니다. 새 타이틀:')).toBeVisible();
    await expect(page.getByRole('heading', { name: menuName })).toBeVisible();

    const menuCard = page.locator('article').filter({ hasText: menuName });
    await menuCard.getByRole('button', { name: '품절 처리' }).click();
    await expect(page.getByText('해당 메뉴를 품절 처리했습니다.')).toBeVisible();
    await expect(menuCard.getByText('재고: 0')).toBeVisible();

    await menuCard.getByRole('button', { name: '판매 재개' }).click();
    await expect(page.getByText('메뉴를 다시 판매 중으로 전환했습니다.')).toBeVisible();
    await expect(menuCard.getByText('재고: 10')).toBeVisible();

    await menuCard.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('메뉴가 삭제되었습니다.')).toBeVisible();
    await expect(page.getByRole('heading', { name: menuName })).toHaveCount(0);

    // 주문 관리 페이지 확인
    await page.goto('/dashboard/orders');
    await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible();
    await expect(page.getByText('주문 #order-sample')).toBeVisible();
  });
});

