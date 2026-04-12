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
// Instagram Business API — app is live in production
export const isInstagramConfigured = true;
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
