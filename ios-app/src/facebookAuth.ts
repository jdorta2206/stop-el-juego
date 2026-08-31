import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

/**
 * Native Facebook Login integration point.
 *
 * The access token is obtained by the native Facebook Login SDK. It is then
 * exchanged server-side so the existing Facebook account can be resolved
 * instead of creating a second player profile.
 */
export async function signInWithFacebook(accessToken: string): Promise<NativeSession> {
  if (!accessToken) {
    throw new Error('Facebook no devolvió un access token válido.');
  }

  const session = await apiFetch<NativeSession>('/api/auth/facebook/native', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });

  await saveSession(session);
  return session;
}
