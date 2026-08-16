import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "stop_ios_session_v1";
const API_BASE_URL = "https://workspaceapi-server-production-178e6.up.railway.app";

export type StopSession = {
  token: string;
  user: {
    id: string;
    name: string | null;
    picture?: string | null;
    loginMethod: string;
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
  await SecureStore.deleteItemAsync(SESSION_KEY);
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" });
  } catch {
    // Local logout must still succeed if the server is temporarily unavailable.
  }
}

/**
 * Native Apple credential acquisition.
 *
 * The credential is deliberately NOT treated as an authenticated STOP session
 * on-device. The identityToken must be exchanged/verified by our backend before
 * we create the normal STOP player token. This prevents accepting a forged
 * client-side player id.
 */
export async function signInWithApple(): Promise<AppleAuthentication.AppleAuthenticationCredential> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign In is only available on iOS.");
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple Sign In no está disponible en este dispositivo.");

  return AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
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
