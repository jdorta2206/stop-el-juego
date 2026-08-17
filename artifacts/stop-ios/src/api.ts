import { API_BASE_URL } from './config';
import { loadSession } from './auth';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await loadSession();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  if (session?.token) headers.set('x-stop-token', session.token);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function checkApiHealth() {
  return apiFetch<unknown>('/api/health');
}
