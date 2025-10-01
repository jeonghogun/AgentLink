import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.setPersistence(import.meta.env.DEV ? inMemoryPersistence : browserLocalPersistence);

export const storage = getStorage(app);

if (import.meta.env.DEV) {
  const authHost = import.meta.env.VITE_AUTH_EMULATOR_HOST ?? 'http://127.0.0.1:9099';
  const storageHost = import.meta.env.VITE_STORAGE_EMULATOR_HOST ?? 'http://127.0.0.1:9199';

  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, authHost, { disableWarnings: true });
  }

  const storageAny = storage as unknown as { host?: string };
  if (!storageAny.host) {
    const url = new URL(storageHost);
    connectStorageEmulator(storage, url.hostname, Number(url.port));
  }
}
