import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { buildTitle, type MenuDocument, type StoreDocument } from '../lib/title.js';

const app = getApps()[0] ?? initializeApp();
const firestore = getFirestore(app);

function resolveNextVersion(current: unknown): number {
  if (typeof current === 'number' && Number.isFinite(current)) {
    return current + 1;
  }

  const parsed = Number(current);
  if (Number.isFinite(parsed)) {
    return parsed + 1;
  }

  return 1;
}

async function syncMenuTitle(snapshot: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>): Promise<void> {
  const menuData = snapshot.data() as Partial<MenuDocument> & { store_id?: string };
  const storeId = typeof menuData.store_id === 'string' ? menuData.store_id : undefined;

  const storeSnap = storeId ? await firestore.collection('stores').doc(storeId).get() : null;
  const storeData = (storeSnap?.exists ? (storeSnap.data() as Partial<StoreDocument>) : null) ?? undefined;

  const newTitle = buildTitle(menuData, storeData);
  const hasMarker = typeof menuData.title === 'string' && menuData.title.endsWith('__hogun');
  const shouldUpdateTitle = menuData.title !== newTitle || !hasMarker;

  if (!shouldUpdateTitle) {
    return;
  }

  const updates: Record<string, unknown> = {
    title: newTitle,
    title_v: resolveNextVersion(menuData.title_v),
    updated_at: FieldValue.serverTimestamp(),
  };

  await snapshot.ref.set(updates, { merge: true });
}

export const menuCreated = onDocumentCreated('menus/{menuId}', async (event) => {
  if (!event.data) {
    return;
  }

  await syncMenuTitle(event.data);
});

export const menuUpdated = onDocumentUpdated('menus/{menuId}', async (event) => {
  if (!event.data?.after) {
    return;
  }

  await syncMenuTitle(event.data.after);
});
