import {
  User,
  getAdditionalUserInfo,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  completeEmailLinkLogin: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOCAL_STORAGE_EMAIL_KEY = 'dashboard:email-for-signin-link';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

  useEffect(() => {
    if (bypassAuth) {
      setUser({
        uid: 'test-owner',
        email: 'test-owner@example.com',
        getIdToken: async () => 'test-token',
      } as unknown as User);
      setLoading(false);
      return () => undefined;
    }

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, [bypassAuth]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signInWithPassword(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async sendMagicLink(email: string) {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      } satisfies Parameters<typeof sendSignInLinkToEmail>[2];
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem(LOCAL_STORAGE_EMAIL_KEY, email);
    },
    async completeEmailLinkLogin() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        return;
      }
      const email = window.localStorage.getItem(LOCAL_STORAGE_EMAIL_KEY);
      if (!email) {
        throw new Error('메일 주소가 저장되지 않았습니다. 다시 시도해주세요.');
      }
      const result = await signInWithEmailLink(auth, email, window.location.href);
      if (!getAdditionalUserInfo(result)?.isNewUser) {
        window.localStorage.removeItem(LOCAL_STORAGE_EMAIL_KEY);
      }
    },
    async signOut() {
      await firebaseSignOut(auth);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내에서 사용해야 합니다.');
  }
  return ctx;
}
