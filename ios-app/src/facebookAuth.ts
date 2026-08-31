import { AccessToken, LoginManager } from 'react-native-fbsdk-next';
import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

export async function signInWithFacebook(): Promise<NativeSession> {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) {
    throw Object.assign(new Error('Inicio de sesión cancelado.'), { code: 'ERR_REQUEST_CANCELED' });
  }

  const token = await AccessToken.getCurrentAccessToken();
  if (!token?.accessToken) throw new Error('Facebook no devolvió un access token válido.');

  const session = await apiFetch<NativeSession>('/api/auth/facebook/native', {
    method: 'POST',
    body: JSON.stringify({ accessToken: token.accessToken.toString() }),
  });
  await saveSession(session);
  return session;
}
