import { apiRequest, dashboardPath } from './client';
import type { Store, StorePayload } from './types';

type StoreResponse = { store: Store };

type UpdateStoreResponse = { store: Store; title_preview?: string };

export async function fetchStore(): Promise<Store> {
  const { store } = await apiRequest<StoreResponse>(dashboardPath('/store'), {
    method: 'GET',
  });
  return store;
}

export async function updateStore(payload: StorePayload): Promise<UpdateStoreResponse> {
  return apiRequest<UpdateStoreResponse>(dashboardPath('/store'), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
