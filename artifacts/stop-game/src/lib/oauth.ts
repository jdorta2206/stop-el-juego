// ─── Redirect-based OAuth helpers ────────────────────────────────────────────
// All auth flows go through the backend to avoid iframe/popup restrictions.

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  picture?: string | null;
  provider: "google" | "facebook" | "instagram" | "tiktok";
}

// Which providers are configured (secrets exist)
export const isGoogleConfigured    = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const isFacebookConfigured  = !!import.meta.env.VITE_FACEBOOK_APP_ID;
// Instagram requires Meta app review to work — show as coming soon until approved
export const isInstagramConfigured = false;
// TikTok requires domain verification + app review (like Instagram) — re-enable after deployment
export const isTikTokConfigured    = false;

function startOAuth(provider: "google" | "facebook" | "instagram" | "tiktok") {
  const returnPath = window.location.pathname + window.location.search;
  sessionStorage.setItem("oauth_return", returnPath);
  const origin = window.location.origin;
  window.location.href =
    `${origin}/api/auth/${provider}/start?return=${encodeURIComponent(returnPath)}`;
}

export function signInWithGoogle()    { startOAuth("google"); }
export function signInWithFacebook()  { startOAuth("facebook"); }
export function signInWithInstagram() { startOAuth("instagram"); }
export function signInWithTikTok()    { startOAuth("tiktok"); }

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
  };
  return map[code] || "Error al iniciar sesión. Inténtalo de nuevo.";
}
