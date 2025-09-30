import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createMenu, deleteMenu, fetchMenus, updateMenu } from '../api/menus';
import type { MenuPayload } from '../api/types';

const MENUS_KEY = (storeId?: string) => ['menus', storeId ?? 'default'];

export function useMenusQuery(storeId?: string) {
  return useQuery({
    queryKey: MENUS_KEY(storeId),
    queryFn: () => fetchMenus(storeId),
    enabled: Boolean(storeId),
  });
}

export function useMenuMutations(storeId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: MENUS_KEY(storeId) });
  };

  const create = useMutation({
    mutationFn: (payload: MenuPayload) => {
      if (!storeId) {
        throw new Error('스토어 정보가 필요합니다.');
      }
      return createMenu(storeId, payload);
    },
    onSuccess: async (menu) => {
      await invalidate();
      toast.success(`메뉴가 저장되었습니다. 새 타이틀: ${menu.title}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '메뉴 저장 중 오류가 발생했습니다.';
      toast.error(message);
    },
  });

  const update = useMutation({
    mutationFn: ({ menuId, payload }: { menuId: string; payload: MenuPayload }) => updateMenu(menuId, payload),
    onSuccess: async (menu) => {
      await invalidate();
      toast.success(`메뉴가 업데이트되었습니다. 새 타이틀: ${menu.title}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '메뉴 업데이트 중 오류가 발생했습니다.';
      toast.error(message);
    },
  });

  const remove = useMutation({
    mutationFn: (menuId: string) => deleteMenu(menuId),
    onSuccess: async () => {
      await invalidate();
      toast.success('메뉴가 삭제되었습니다.');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '메뉴 삭제 중 오류가 발생했습니다.';
      toast.error(message);
    },
  });

  return { create, update, remove };
}
