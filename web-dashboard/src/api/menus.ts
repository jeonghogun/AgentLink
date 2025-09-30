import { apiRequest, dashboardPath } from './client';
import type { Menu, MenuPayload } from './types';

type MenusResponse = { menus: Menu[] };
type MenuResponse = { menu: Menu };

type MenuId = string;

export async function fetchMenus(storeId?: string): Promise<Menu[]> {
  const searchParams = new URLSearchParams();
  if (storeId) {
    searchParams.set('storeId', storeId);
  }
  const { menus } = await apiRequest<MenusResponse>(dashboardPath(`/menus?${searchParams.toString()}`), {
    method: 'GET',
  });
  return menus;
}

export async function createMenu(storeId: string, payload: MenuPayload): Promise<Menu> {
  const { menu } = await apiRequest<MenuResponse>(dashboardPath(`/stores/${storeId}/menus`), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return menu;
}

export async function updateMenu(menuId: MenuId, payload: MenuPayload): Promise<Menu> {
  const { menu } = await apiRequest<MenuResponse>(dashboardPath(`/menus/${menuId}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return menu;
}

export async function deleteMenu(menuId: MenuId): Promise<void> {
  await apiRequest<void>(dashboardPath(`/menus/${menuId}`), {
    method: 'DELETE',
  });
}
