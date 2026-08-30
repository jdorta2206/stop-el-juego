import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './api';

const SESSION_KEY = 'stop_ios_session';

export type NativeSession = {
  token: string;
  playerId: string;
  email?: string;
  displayName?: string;
};

export async function getSession(): Promise<NativeSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NativeSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: NativeSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function authenticatedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init?.headers);
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
  return apiFetch<T>(path, { ...init, headers });
}
