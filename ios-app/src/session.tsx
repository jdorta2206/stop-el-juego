import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, getSession, type NativeSession } from './auth';
import { signInWithApple } from './appleAuth';
import { signInWithGoogle } from './googleAuth';
import { signInWithFacebook } from './facebookAuth';

type SessionContextValue = {
  session: NativeSession | null;
  loading: boolean;
  signInApple: () => Promise<NativeSession>;
  signInGoogle: (credential: { idToken: string; accessToken?: string }) => Promise<NativeSession>;
  signInFacebook: (accessToken: string) => Promise<NativeSession>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<NativeSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setSession(await getSession());
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signInApple = useCallback(async () => {
    const next = await signInWithApple();
    setSession(next);
    return next;
  }, []);

  const signInGoogle = useCallback(async (credential: { idToken: string; accessToken?: string }) => {
    const next = await signInWithGoogle(credential);
    setSession(next);
    return next;
  }, []);

  const signInFacebook = useCallback(async (accessToken: string) => {
    const next = await signInWithFacebook(accessToken);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, signInApple, signInGoogle, signInFacebook, signOut, refresh }),
    [session, loading, signInApple, signInGoogle, signInFacebook, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe utilizarse dentro de SessionProvider');
  return value;
}
