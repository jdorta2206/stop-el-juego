import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<NativeSession> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }).catch(() => undefined);
    await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    if (!tokens.idToken) throw new Error('Google no devolvió un ID token válido.');

    const session = await apiFetch<NativeSession>('/api/auth/google/native', {
      method: 'POST',
      body: JSON.stringify({ idToken: tokens.idToken, accessToken: tokens.accessToken }),
    });
    await saveSession(session);
    return session;
  } catch (error) {
    if ((error as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw Object.assign(new Error('Inicio de sesión cancelado.'), { code: 'ERR_REQUEST_CANCELED' });
    }
    throw error;
  }
}
