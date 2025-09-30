import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../providers/AuthProvider';
import { useInvalidateSearchPreview } from '../../hooks/useSearchPreview';
import { useMenuMutations, useMenusQuery } from '../../hooks/useMenusQuery';
import { useStoreQuery } from '../../hooks/useStoreQuery';
import type { Menu } from '../../api/types';
import { MenuEditor, MenuFormValues, toMenuPayload } from './MenuEditor';

export function MenusPage() {
  const { data: store } = useStoreQuery();
  const storeId = store?.id;
  const { data: menus, isLoading, isError, error } = useMenusQuery(storeId);
  const mutations = useMenuMutations(storeId);
  const invalidateSearch = useInvalidateSearchPreview();
  const { user } = useAuth();

  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ code?: string; message: string } | null>(null);

  const ownerUid = user?.uid ?? store?.owner_uid ?? 'anonymous';

  const openCreate = () => {
    setEditingMenu(null);
    setIsEditorOpen(true);
  };

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingMenu(null);
  };

  const handleSubmit = async (values: MenuFormValues) => {
    try {
      if (!storeId) {
        throw new Error('스토어 정보가 필요합니다.');
      }
      if (editingMenu) {
        await mutations.update.mutateAsync({ menuId: editingMenu.id, payload: toMenuPayload(values) });
      } else {
        await mutations.create.mutateAsync(toMenuPayload(values));
      }
      invalidateSearch(store?.region);
      closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : '메뉴 저장 중 오류가 발생했습니다.';
      const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
      setErrorDialog({ code, message });
    }
  };

  const handleDelete = async (menu: Menu) => {
    try {
      await mutations.remove.mutateAsync(menu.id);
      invalidateSearch(store?.region);
    } catch (error) {
      const message = error instanceof Error ? error.message : '메뉴 삭제 중 오류가 발생했습니다.';
      const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
      setErrorDialog({ code, message });
    }
  };

  const toggleSoldOut = async (menu: Menu) => {
    try {
      const payload = toMenuPayload({
        name: menu.name,
        price: menu.price,
        currency: menu.currency,
        stock: menu.stock > 0 ? 0 : 10,
        description: menu.description ?? '',
        option_groups: menu.option_groups,
        images: menu.images,
      });
      await mutations.update.mutateAsync({ menuId: menu.id, payload });
      invalidateSearch(store?.region);
      toast.success(menu.stock > 0 ? '해당 메뉴를 품절 처리했습니다.' : '메뉴를 다시 판매 중으로 전환했습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '재고 변경 중 오류가 발생했습니다.';
      const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
      setErrorDialog({ code, message });
    }
  };

  const editorInitialValues = useMemo<MenuFormValues | undefined>(() => {
    if (!editingMenu) return undefined;
    return {
      name: editingMenu.name,
      price: editingMenu.price,
      currency: editingMenu.currency,
      stock: editingMenu.stock,
      description: editingMenu.description ?? '',
      option_groups: editingMenu.option_groups,
      images: editingMenu.images,
    };
  }, [editingMenu]);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">메뉴 관리</h2>
          <p className="text-sm text-slate-400">Functions REST를 통해 메뉴를 조회/생성/수정/삭제합니다.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          새 메뉴 추가
        </button>
      </header>

      {isLoading && <p className="text-sm text-slate-300">메뉴 목록을 불러오는 중입니다...</p>}
      {isError && <p className="text-sm text-red-400">{error instanceof Error ? error.message : '메뉴를 불러오지 못했습니다.'}</p>}

      {!isLoading && !isError && menus && menus.length === 0 && (
        <p className="text-sm text-slate-300">등록된 메뉴가 없습니다. 새 메뉴를 추가해주세요.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {menus?.map((menu) => (
          <article key={menu.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">{menu.name}</h3>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{menu.currency} {menu.price}</span>
            </header>
            <p className="text-xs text-slate-400">재고: {menu.stock}</p>
            <p className="text-xs text-slate-400">타이틀: {menu.title}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => openEdit(menu)}
                className="rounded border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => toggleSoldOut(menu)}
                className="rounded border border-amber-500 px-3 py-1 text-amber-200 hover:bg-amber-500/20"
              >
                {menu.stock > 0 ? '품절 처리' : '판매 재개'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(menu)}
                className="rounded border border-red-500 px-3 py-1 text-red-300 hover:bg-red-500/10"
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-100">{editingMenu ? '메뉴 수정' : '새 메뉴 생성'}</h3>
              <button type="button" onClick={closeEditor} className="text-sm text-slate-400 hover:text-slate-200">
                닫기
              </button>
            </div>
            <MenuEditor ownerUid={ownerUid} initialValues={editorInitialValues} onSubmit={handleSubmit} onCancel={closeEditor} />
          </div>
        </div>
      )}

      {errorDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/60 bg-slate-900 p-6 text-slate-100">
            <h3 className="text-lg font-semibold text-red-300">오류가 발생했습니다.</h3>
            <p className="mt-2 text-sm text-slate-200">{errorDialog.message}</p>
            {errorDialog.code && <p className="mt-1 text-xs text-slate-400">코드: {errorDialog.code}</p>}
            <button
              type="button"
              onClick={() => setErrorDialog(null)}
              className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
