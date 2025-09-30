import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchOrders, refreshOrder } from '../api/orders';

const ORDERS_KEY = (storeId?: string) => ['orders', storeId ?? 'default'];

export function useOrdersQuery(storeId?: string) {
  return useQuery({
    queryKey: ORDERS_KEY(storeId),
    queryFn: () => fetchOrders(storeId),
    enabled: Boolean(storeId),
    refetchInterval: 10_000,
  });
}

export function useOrderRefreshMutation(storeId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => refreshOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ORDERS_KEY(storeId) });
      toast.success('주문 상태를 갱신했습니다.');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '주문 상태 갱신 중 오류가 발생했습니다.';
      toast.error(message);
    },
  });
}
