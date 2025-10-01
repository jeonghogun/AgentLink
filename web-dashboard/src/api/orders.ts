import { apiRequest, dashboardPath } from './client';
import type { Order } from './types';

type OrdersResponse = { orders: Order[] };

type OrderStatusResponse = { order: Order };

export async function fetchOrders(storeId?: string): Promise<Order[]> {
  const params = new URLSearchParams();
  if (storeId) {
    params.set('storeId', storeId);
  }
  const { orders } = await apiRequest<OrdersResponse>(dashboardPath(`/orders?${params.toString()}`), {
    method: 'GET',
  });
  return orders;
}

export async function refreshOrder(orderId: string): Promise<Order> {
  const { order } = await apiRequest<OrderStatusResponse>(dashboardPath(`/orders/${orderId}`), {
    method: 'GET',
  });
  return order;
}
