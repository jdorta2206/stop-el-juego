import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { apiFetch } from './api';
import { saveSession, type NativeSession } from './auth';

export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<NativeSession> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Sign in with Apple no está disponible en este dispositivo.');

  // Bind this authentication request to the identity token returned by Apple.
  // The backend must verify the same nonce from the token claims.
  const nonce = Crypto.randomUUID();

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple no devolvió un identityToken válido.');
  }

  const session = await apiFetch<NativeSession>('/api/auth/apple/native', {
    method: 'POST',
    body: JSON.stringify({
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
      nonce,
    }),
  });

  await saveSession(session);
  return session;
}
