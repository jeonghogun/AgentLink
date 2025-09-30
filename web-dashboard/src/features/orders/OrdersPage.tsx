import { useState } from 'react';
import { useOrdersQuery, useOrderRefreshMutation } from '../../hooks/useOrdersQuery';
import { useStoreQuery } from '../../hooks/useStoreQuery';
import type { Order } from '../../api/types';

export function OrdersPage() {
  const { data: store } = useStoreQuery();
  const storeId = store?.id;
  const { data: orders, isLoading, isError, error } = useOrdersQuery(storeId);
  const refreshMutation = useOrderRefreshMutation(storeId);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const closeOrder = () => {
    setSelectedOrder(null);
  };

  const handleRefresh = (orderId: string) => {
    refreshMutation.mutate(orderId);
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-100">주문 관리</h2>
        <p className="text-sm text-slate-400">주문 상태를 조회하고 Functions REST로 상태를 갱신합니다.</p>
      </header>

      {isLoading && <p className="text-sm text-slate-300">주문 목록을 불러오는 중입니다...</p>}
      {isError && <p className="text-sm text-red-400">{error instanceof Error ? error.message : '주문을 불러오지 못했습니다.'}</p>}

      <div className="space-y-3">
        {orders?.map((order) => (
          <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">주문 #{order.id}</h3>
                <p className="text-xs text-slate-400">상태: {order.status} / 결제: {order.payment_status}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleRefresh(order.id)}
                  className="rounded border border-slate-700 px-3 py-1 text-slate-200 hover:bg-slate-800"
                >
                  상태 새로고침
                </button>
                <button
                  type="button"
                  onClick={() => openOrder(order)}
                  className="rounded border border-emerald-500 px-3 py-1 text-emerald-200 hover:bg-emerald-500/20"
                >
                  상세 보기
                </button>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-slate-300">
              {order.items.map((item) => (
                <li key={`${order.id}-${item.menu_id}`}>
                  {item.name} × {item.qty} (옵션 {item.selected_options.join(', ') || '없음'})
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!isLoading && !isError && !orders?.length && <p className="text-sm text-slate-300">주문이 아직 없습니다.</p>}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">주문 상세 #{selectedOrder.id}</h3>
              <button type="button" onClick={closeOrder} className="text-sm text-slate-400 hover:text-slate-200">
                닫기
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-300">ETA: {selectedOrder.eta_minutes}분</p>
            <p className="text-sm text-slate-300">영수증: {selectedOrder.receipt_id}</p>
            <h4 className="mt-4 text-sm font-semibold text-slate-100">타임라인</h4>
            <ul className="mt-2 space-y-2 text-xs text-slate-300">
              {selectedOrder.timeline.map((entry) => (
                <li key={entry.at} className="rounded border border-slate-800 px-3 py-2">
                  <span className="font-semibold text-emerald-200">{entry.status}</span> — {entry.at}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
