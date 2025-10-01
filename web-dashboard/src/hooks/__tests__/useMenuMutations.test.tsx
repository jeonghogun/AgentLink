import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { describe, expect, it, vi } from 'vitest';
import { useMenuMutations } from '../useMenusQuery';

vi.mock('../../api/menus', () => ({
  createMenu: vi.fn(),
  updateMenu: vi.fn(),
  deleteMenu: vi.fn(),
}));

const menusApi = await import('../../api/menus');
const updateMenu = vi.mocked(menusApi.updateMenu);
const deleteMenu = vi.mocked(menusApi.deleteMenu);

describe('useMenuMutations', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient();
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

  it('shows toast with new title when menu is updated', async () => {
    updateMenu.mockResolvedValue({
      id: 'menu-1',
      store_id: 'store-1',
      name: '테스트 메뉴',
      price: 1000,
      currency: 'KRW',
      stock: 1,
      option_groups: [],
      images: [],
      title: '서울_테스트_1000__hogun',
    } as never);

    const { result } = renderHook(() => useMenuMutations('store-1'), { wrapper });

    await result.current.update.mutateAsync({
      menuId: 'menu-1',
      payload: { name: '테스트 메뉴', price: 1000, currency: 'KRW', stock: 1, option_groups: [], images: [], description: '' },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('메뉴가 업데이트되었습니다. 새 타이틀: 서울_테스트_1000__hogun');
    });
  });

  it('invokes deleteMenu and shows success toast', async () => {
    deleteMenu.mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useMenuMutations('store-1'), { wrapper });

    await result.current.remove.mutateAsync('menu-2');

    await waitFor(() => {
      expect(deleteMenu).toHaveBeenCalledWith('menu-2');
      expect(toast.success).toHaveBeenCalledWith('메뉴가 삭제되었습니다.');
    });
  });
});
