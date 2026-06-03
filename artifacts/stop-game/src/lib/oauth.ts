// ─── Redirect-based OAuth helpers ────────────────────────────────────────────
// All auth flows go through the backend to avoid iframe/popup restrictions.

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  picture?: string | null;
  provider: "google" | "facebook" | "instagram" | "tiktok" | "apple";
}

// Which providers are configured (secrets exist)
export const isGoogleConfigured    = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const isFacebookConfigured  = !!import.meta.env.VITE_FACEBOOK_APP_ID;
// Instagram login disabled: Meta's current Instagram API only allows
// professional/business accounts, so normal players can't sign in with it.
// Use Facebook (Meta) login instead, which works for everyone.
export const isInstagramConfigured = false;
// TikTok requires domain verification + app review (like Instagram) — re-enable after deployment
export const isTikTokConfigured    = false;
// Apple Sign In — requires Apple Developer Program ($99/yr) + Service ID + private key
// Becomes true automatically once VITE_APPLE_CLIENT_ID is added to env secrets
export const isAppleConfigured = !!import.meta.env.VITE_APPLE_CLIENT_ID;

function startOAuth(provider: "google" | "facebook" | "instagram" | "tiktok" | "apple") {
  const returnPath = window.location.pathname + window.location.search;
  sessionStorage.setItem("oauth_return", returnPath);
  const apiBase = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
    ?? window.location.origin;
  window.location.href =
    `${apiBase}/api/auth/${provider}/start?return=${encodeURIComponent(returnPath)}`;
}

export function signInWithGoogle()    { startOAuth("google"); }
export function signInWithFacebook()  { startOAuth("facebook"); }
export function signInWithInstagram() { startOAuth("instagram"); }
export function signInWithTikTok()    { startOAuth("tiktok"); }
export function signInWithApple()     { startOAuth("apple"); }

// Cross-origin OAuth handoff. The backend bridge runs on the canonical OAuth
// domain (stop-el-juego.replit.app) but redirects the user back to whatever
// origin they started from (e.g. www.stopjuegodepalabras.com / the TWA).
// sessionStorage/localStorage are per-origin, so the bridge ALSO encodes the
// handoff items (oauth_user, the session token, fb_access_token) in the URL
// hash. Import them into THIS origin's storage on load, then strip the hash so
// the token never lingers in the address bar / browser history. Must run
// BEFORE anything reads that storage (usePlayer restore, AuthModal).
export function consumeAuthHandoff(): void {
  try {
    const hash = window.location.hash;
    if (!hash || hash.indexOf("stopauth=") === -1) return;
    const m = hash.match(/stopauth=([^&]+)/);
    if (!m || !m[1]) return;
    const items = JSON.parse(decodeURIComponent(m[1])) as [string, string][];
    // Only import keys the server bridge is known to emit, so a hand-crafted
    // hash can't poison arbitrary storage entries.
    const ALLOWED = new Set(["oauth_user", "fb_access_token", "stop_session_token"]);
    for (const [k, v] of items) {
      if (!ALLOWED.has(k) || typeof v !== "string") continue;
      try {
        // Keep this in sync with the server bridge: the session token persists
        // in localStorage; everything else is session-scoped.
        const store = k === "stop_session_token" ? window.localStorage : window.sessionStorage;
        store.setItem(k, v);
      } catch { /* storage unavailable — ignore */ }
    }
    // Remove only the stopauth fragment, preserving any other hash content.
    let cleaned = hash.replace(/(^#|&)stopauth=[^&]*/, "");
    if (cleaned === "#") cleaned = "";
    if (cleaned && cleaned[0] !== "#") cleaned = "#" + cleaned.replace(/^&/, "");
    const newUrl = window.location.pathname + window.location.search + cleaned;
    window.history.replaceState({}, "", newUrl);
  } catch { /* malformed handoff — ignore */ }
}

// After the backend callback, the bridge page writes `oauth_user` to
// sessionStorage before redirecting back here. Read it once.
export function checkOAuthReturn(): OAuthUser | null {
  // Check URL for error params first
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
    google_cancelled:         "Inicio con Google cancelado.",
    google_failed:            "Error al conectar con Google. Inténtalo de nuevo.",
    google_not_configured:    "Google no está configurado aún.",
    facebook_cancelled:       "Inicio con Facebook cancelado.",
    facebook_failed:          "Error al conectar con Facebook. Inténtalo de nuevo.",
    facebook_not_configured:  "Facebook no está configurado aún.",
    instagram_cancelled:      "Inicio con Instagram cancelado.",
    instagram_failed:         "Error al conectar con Instagram. Inténtalo de nuevo.",
    instagram_not_configured: "Instagram no está configurado aún.",
    tiktok_cancelled:         "Inicio con TikTok cancelado.",
    tiktok_failed:            "Error al conectar con TikTok. Inténtalo de nuevo.",
    tiktok_not_configured:    "TikTok no está configurado aún.",
    apple_cancelled:          "Inicio con Apple cancelado.",
    apple_failed:             "Error al conectar con Apple. Inténtalo de nuevo.",
    apple_not_configured:     "Apple no está configurado aún.",
  };
  return map[code] || "Error al iniciar sesión. Inténtalo de nuevo.";
}
