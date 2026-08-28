// ─── Redirect-based OAuth helpers ────────────────────────────────────────────
// All auth flows go through the backend to avoid iframe/popup restrictions.

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  picture?: string | null;
  provider: "google" | "facebook" | "instagram" | "tiktok" | "apple";
}

export const isGoogleConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const isFacebookConfigured = !!import.meta.env.VITE_FACEBOOK_APP_ID;
export const isInstagramConfigured = false;
export const isTikTokConfigured = false;
export const isAppleConfigured = !!import.meta.env.VITE_APPLE_CLIENT_ID;

function startOAuth(provider: "google" | "facebook" | "instagram" | "tiktok" | "apple") {
  const returnPath = window.location.pathname + window.location.search;
  sessionStorage.setItem("oauth_return", returnPath);

  const apiBase = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
    ?? window.location.origin;

  // Do not rely on Referer to recover the web origin. Modern browser privacy
  // policies/extensions can omit it. Explicitly send the exact origin so the
  // OAuth bridge returns the session to the site where login was started.
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

// Cross-origin OAuth handoff. The backend bridge carries the authenticated
// session token in the URL hash, allowing the destination origin to import it
// into its own localStorage before React mounts.
export function consumeAuthHandoff(): void {
  try {
    const hash = window.location.hash;
    if (!hash || hash.indexOf("stopauth=") === -1) return;
    const m = hash.match(/stopauth=([^&]+)/);
    if (!m || !m[1]) return;
    const items = JSON.parse(decodeURIComponent(m[1])) as [string, string][];
    const ALLOWED = new Set(["oauth_user", "fb_access_token", "stop_session_token"]);
    for (const [k, v] of items) {
      if (!ALLOWED.has(k) || typeof v !== "string") continue;
      try {
        const store = k === "stop_session_token" ? window.localStorage : window.sessionStorage;
        store.setItem(k, v);
      } catch { /* storage unavailable — ignore */ }
    }
    let cleaned = hash.replace(/(^#|&)stopauth=[^&]*/, "");
    if (cleaned === "#") cleaned = "";
    if (cleaned && cleaned[0] !== "#") cleaned = "#" + cleaned.replace(/^&/, "");
    const newUrl = window.location.pathname + window.location.search + cleaned;
    window.history.replaceState({}, "", newUrl);
  } catch { /* malformed handoff — ignore */ }
}

export function checkOAuthReturn(): OAuthUser | null {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  if (authError) {
    window.history.replaceState({}, "", window.location.pathname);
    throw new Error(friendlyError(authError));
  }

  const raw = sessionStorage.getItem("oauth_user");
  if (raw) {
    try {
      const u = JSON.parse(raw) as OAuthUser;
      sessionStorage.removeItem("oauth_user");
      return u;
    } catch {
      sessionStorage.removeItem("oauth_user");
    }
  }
  return null;
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    google_cancelled: "Inicio con Google cancelado.",
    google_failed: "Error al conectar con Google. Inténtalo de nuevo.",
    google_not_configured: "Google no está configurado aún.",
    facebook_cancelled: "Inicio con Facebook cancelado.",
    facebook_failed: "Error al conectar con Facebook. Inténtalo de nuevo.",
    facebook_not_configured: "Facebook no está configurado aún.",
    instagram_cancelled: "Inicio con Instagram cancelado.",
    instagram_failed: "Error al conectar con Instagram. Inténtalo de nuevo.",
    instagram_not_configured: "Instagram no está configurado aún.",
    tiktok_cancelled: "Inicio con TikTok cancelado.",
    tiktok_failed: "Error al conectar con TikTok. Inténtalo de nuevo.",
    tiktok_not_configured: "TikTok no está configurado aún.",
    apple_cancelled: "Inicio con Apple cancelado.",
    apple_failed: "Error al conectar con Apple. Inténtalo de nuevo.",
    apple_not_configured: "Apple no está configurado aún.",
  };
  return map[code] || "Error al iniciar sesión. Inténtalo de nuevo.";
}
