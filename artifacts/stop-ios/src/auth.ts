import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

const SESSION_KEY = "stop_ios_session_v1";
const API_BASE_URL = "https://workspaceapi-server-production-178e6.up.railway.app";
const APP_SCHEME = "stopjuego://oauth";
const PLAYER_TOKEN_BRIDGE_KEY = "stop_session_token";

export type StopSession = {
  token: string;
  user: { id: string; name: string | null; email?: string | null; picture?: string | null; provider?: string; loginMethod?: string };
};

export async function loadSession(): Promise<StopSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StopSession; } catch { await SecureStore.deleteItemAsync(SESSION_KEY); return null; }
}

export async function clearSession(): Promise<void> {
  const session = await loadSession();
  await SecureStore.deleteItemAsync(SESSION_KEY);
  try { await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", headers: session?.token ? { "x-stop-token": session.token } : undefined }); } catch { }
}

function createNonce(): string { return Crypto.randomUUID(); }

async function finishWebOAuth(resultUrl: string, provider: "google" | "facebook"): Promise<StopSession> {
  const hash = resultUrl.includes("#") ? resultUrl.slice(resultUrl.indexOf("#") + 1) : "";
  const raw = new URLSearchParams(hash).get("stopauth");
  if (!raw) throw new Error(`No se recibió la sesión de ${provider}.`);
  let items: unknown;
  try { items = JSON.parse(decodeURIComponent(raw)); } catch { throw new Error("Respuesta de autenticación no válida."); }
  if (!Array.isArray(items)) throw new Error("Respuesta de autenticación no válida.");
  const map = new Map<string, string>();
  for (const item of items) if (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string") map.set(item[0], item[1]);
  const token = map.get(PLAYER_TOKEN_BRIDGE_KEY);
  const rawUser = map.get("oauth_user");
  if (!token || !rawUser) throw new Error("El servidor no devolvió una sesión STOP válida.");
  let user: StopSession["user"];
  try { user = JSON.parse(rawUser) as StopSession["user"]; } catch { throw new Error("Perfil de usuario no válido."); }
  if (!user?.id) throw new Error("Identidad STOP no válida.");
  const session: StopSession = { token, user: { ...user, provider } };
  await saveSession(session);
  return session;
}

export async function signInWithProvider(provider: "google" | "facebook"): Promise<StopSession> {
  if (Platform.OS !== "ios") throw new Error("Este acceso está preparado para iOS.");
  const startUrl = `${API_BASE_URL}/api/auth/${provider}/start?return=${encodeURIComponent("/")}&returnOrigin=${encodeURIComponent(APP_SCHEME)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, APP_SCHEME);
  if (result.type !== "success" || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") throw new Error("Inicio de sesión cancelado.");
    throw new Error(`No se pudo iniciar sesión con ${provider}.`);
  }
  return finishWebOAuth(result.url, provider);
}

export async function signInWithApple(): Promise<StopSession> {
  if (Platform.OS !== "ios") throw new Error("Apple Sign In is only available on iOS.");
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error("Apple Sign In no está disponible en este dispositivo.");
  const nonce = createNonce();
  const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce });
  if (!credential.identityToken) throw new Error("Apple no devolvió un identity token válido.");
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
  const response = await fetch(`${API_BASE_URL}/api/auth/apple/native`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ identityToken: credential.identityToken, nonce, user: credential.user, email: credential.email, name: fullName || undefined }) });
  if (!response.ok) { const body = await response.text().catch(() => ""); throw new Error(body || `Apple authentication failed (${response.status})`); }
  const data = (await response.json()) as { ok: boolean; token: string; user: StopSession["user"] };
  if (!data.ok || !data.token || !data.user?.id) throw new Error("Respuesta de autenticación Apple no válida.");
  const session: StopSession = { token: data.token, user: data.user };
  await saveSession(session);
  return session;
}

export async function saveSession(session: StopSession): Promise<void> { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)); }

export const authConfig = { apiBaseUrl: API_BASE_URL, googleStart: `${API_BASE_URL}/api/auth/google/start`, facebookStart: `${API_BASE_URL}/api/auth/facebook/start`, appleStart: `${API_BASE_URL}/api/auth/apple/start` };
