import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "stop_ios_session_v1";
const API_BASE_URL = "https://workspaceapi-server-production-178e6.up.railway.app";

export type StopSession = {
  token: string;
  user: {
    id: string;
    name: string | null;
    email?: string | null;
    picture?: string | null;
    provider?: string;
    loginMethod?: string;
  };
};

export async function loadSession(): Promise<StopSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StopSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const session = await loadSession();
  await SecureStore.deleteItemAsync(SESSION_KEY);
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: session?.token ? { "x-stop-token": session.token } : undefined,
    });
  } catch {
    // Local logout must still succeed if the server is temporarily unavailable.
  }
}

function createNonce(): string {
  return Crypto.randomUUID();
}

/**
 * Native Apple credential acquisition followed by server-side verification.
 * The app never turns Apple.user into a trusted STOP identity by itself.
 */
export async function signInWithApple(): Promise<StopSession> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign In is only available on iOS.");
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple Sign In no está disponible en este dispositivo.");

  const nonce = createNonce();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple no devolvió un identity token válido.");
  }

  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const response = await fetch(`${API_BASE_URL}/api/auth/apple/native`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identityToken: credential.identityToken,
      nonce,
      user: credential.user,
      email: credential.email,
      name: fullName || undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Apple authentication failed (${response.status})`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    token: string;
    user: StopSession["user"];
  };

  if (!data.ok || !data.token || !data.user?.id) {
    throw new Error("Respuesta de autenticación Apple no válida.");
  }

  const session: StopSession = { token: data.token, user: data.user };
  await saveSession(session);
  return session;
}

export async function saveSession(session: StopSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export const authConfig = {
  apiBaseUrl: API_BASE_URL,
  googleStart: `${API_BASE_URL}/api/auth/google/start`,
  facebookStart: `${API_BASE_URL}/api/auth/facebook/start`,
  appleStart: `${API_BASE_URL}/api/auth/apple/start`,
};
