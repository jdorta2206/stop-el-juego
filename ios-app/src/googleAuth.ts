import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

/**
 * Native Google Sign-In integration point.
 *
 * The native credential must be supplied by the Google Sign-In SDK and then
 * exchanged with the backend. Keeping the exchange isolated here prevents
 * the UI from depending on Google SDK details and makes account linking
 * explicit: the backend must resolve the existing Google account.
 */
export async function signInWithGoogle(credential: {
  idToken: string;
  accessToken?: string;
}): Promise<NativeSession> {
  if (!credential.idToken) {
    throw new Error('Google no devolvió un ID token válido.');
  }

  const session = await apiFetch<NativeSession>('/api/auth/google/native', {
    method: 'POST',
    body: JSON.stringify({
      idToken: credential.idToken,
      accessToken: credential.accessToken,
    }),
  });

  await saveSession(session);
  return session;
}
