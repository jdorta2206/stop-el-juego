import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

let configured = false;

function configureGoogle() {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error('Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para Google Sign-In.');
  }
  GoogleSignin.configure({ webClientId });
  configured = true;
}

export async function signInWithGoogle(): Promise<NativeSession> {
  configureGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google no devolvió un ID token válido.');

  const session = await apiFetch<NativeSession>('/api/auth/google/native', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  await saveSession(session);
  return session;
}

export function isGoogleSignInCanceled(error: unknown): boolean {
  return (error as { code?: string })?.code === statusCodes.SIGN_IN_CANCELLED;
}
