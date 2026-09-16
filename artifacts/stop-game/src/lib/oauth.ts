// ─── Redirect-based OAuth helpers ────────────────────────────────────────────
// All auth flows go through the backend to avoid iframe/popup restrictions.

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  picture?: string | null;
  provider: "google" | "facebook" | "instagram" | "tiktok" | "apple";
}

export const isGoogleConfigured = true;
export const isFacebookConfigured = true;
export const isInstagramConfigured = false;
export const isTikTokConfigured = false;
export const isAppleConfigured = !!import.meta.env.VITE_APPLE_CLIENT_ID;

const PLAYER_STORAGE_KEY = "stop_player_v2";
const SESSION_TOKEN_KEY = "stop_session_token";
const AVATAR_COLORS = ["#f9a825", "#42a5f5", "#66bb6a", "#ab47bc", "#ef5350", "#26a69a"];

function startOAuth(provider: "google" | "facebook" | "instagram" | "tiktok" | "apple") {
  const returnPath = window.location.pathname + window.location.search;
  try { sessionStorage.setItem("oauth_return", returnPath); } catch {}
  const apiBase = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? window.location.origin;
  const origin = window.location.origin;
  const url = new URL(`${apiBase}/api/auth/${provider}/start`);
  url.searchParams.set("return", returnPath);
  url.searchParams.set("origin", origin);
  window.location.href = url.toString();
}

export function signInWithGoogle() { startOAuth("google"); }
export function signInWithFacebook() { startOAuth("facebook"); }
export function signInWithInstagram() { startOAuth("instagram"); }
export function signInWithTikTok() { startOAuth("tiktok"); }
export function signInWithApple() { startOAuth("apple"); }

/**
 * Imports OAuth material before React mounts.
 * The callback may land on the backend origin first, then hand the data to the
 * canonical web origin through the URL fragment. Persist BOTH the token and a
 * local player profile here so React cannot race /api/auth/me and hide a valid
 * OAuth login behind a transient 401.
 */
export function consumeAuthHandoff(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryHandoff = params.get("stopauth");
    const hash = window.location.hash;
    const match = hash.match(/(?:^#|&)stopauth=([^&]+)/);
    const encoded = match?.[1] || queryHandoff;
    if (!encoded) return;

    const items = JSON.parse(decodeURIComponent(encoded)) as [string, string][];
    const allowed = new Set(["oauth_user", "fb_access_token", "stop_session_token"]);
    const values: Record<string, string> = {};

    for (const [key, value] of items) {
      if (!allowed.has(key) || typeof value !== "string" || !value) continue;
      values[key] = value;
      try {
        if (key === "stop_session_token") localStorage.setItem(SESSION_TOKEN_KEY, value);
        else {
          sessionStorage.setItem(key, value);
          localStorage.setItem(key, value);
        }
      } catch {}
    }

    // Make the OAuth profile immediately available to usePlayer(). This is a
    // local bootstrap only; the signed stop_session_token remains the source
    // of truth for server requests and is restored/reissued by /api/auth/me.
    if (values.oauth_user) {
      try {
        const user = JSON.parse(values.oauth_user) as OAuthUser;
        if (user?.id && user?.name) {
          const existingRaw = localStorage.getItem(PLAYER_STORAGE_KEY);
          const existing = existingRaw ? JSON.parse(existingRaw) : null;
          const avatarColor = existing?.avatarColor || AVATAR_COLORS[0];
          const profile = {
            id: String(user.id),
            name: String(user.name).trim().slice(0, 14),
            avatarColor,
            loginMethod: user.provider || null,
            picture: user.picture ?? null,
            fbAccessToken: values.fb_access_token || null,
          };
          if (profile.name) localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(profile));
        }
      } catch {}
    }

    params.delete("stopauth");
    const cleanedHash = hash.replace(/(^#|&)stopauth=[^&]*/, "").replace(/^#$/, "");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${cleanedHash}`);
  } catch {}
}

export function checkOAuthReturn(): OAuthUser | null {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  if (authError) {
    window.history.replaceState({}, "", window.location.pathname);
    throw new Error(friendlyError(authError));
  }
  let raw: string | null = null;
  try { raw = sessionStorage.getItem("oauth_user"); } catch {}
  if (!raw) { try { raw = localStorage.getItem("oauth_user"); } catch {} }
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as OAuthUser;
    try { sessionStorage.removeItem("oauth_user"); } catch {}
    try { localStorage.removeItem("oauth_user"); } catch {}
    return user;
  } catch {
    try { sessionStorage.removeItem("oauth_user"); } catch {}
    try { localStorage.removeItem("oauth_user"); } catch {}
    return null;
  }
}

export function consumeFacebookAccessToken(): string | null {
  let token: string | null = null;
  try { token = sessionStorage.getItem("fb_access_token"); } catch {}
  if (!token) { try { token = localStorage.getItem("fb_access_token"); } catch {} }
  if (token) {
    try { sessionStorage.removeItem("fb_access_token"); } catch {}
    try { localStorage.removeItem("fb_access_token"); } catch {}
  }
  return token;
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    google_cancelled: "Inicio con Google cancelado.", google_failed: "Error al conectar con Google. Inténtalo de nuevo.", google_not_configured: "Google no está configurado aún.",
    facebook_cancelled: "Inicio con Facebook cancelado.", facebook_failed: "Error al conectar con Facebook. Inténtalo de nuevo.", facebook_not_configured: "Facebook no está configurado aún.",
    instagram_cancelled: "Inicio con Instagram cancelado.", instagram_failed: "Error al conectar con Instagram. Inténtalo de nuevo.", instagram_not_configured: "Instagram no está configurado aún.",
    tiktok_cancelled: "Inicio con TikTok cancelado.", tiktok_failed: "Error al conectar con TikTok. Inténtalo de nuevo.", tiktok_not_configured: "TikTok no está configurado aún.",
    apple_cancelled: "Inicio con Apple cancelado.", apple_failed: "Error al conectar con Apple. Inténtalo de nuevo.", apple_not_configured: "Apple no está configurado aún.",
  };
  return map[code] || "Error al iniciar sesión. Inténtalo de nuevo.";
}
