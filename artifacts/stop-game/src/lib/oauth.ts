// ─── Real OAuth helpers ───────────────────────────────────────────────────────

export interface OAuthUser {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  provider: "google" | "facebook" | "instagram";
}

// ── Load a script once ────────────────────────────────────────────────────────
function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ── Decode a Google JWT without a library ─────────────────────────────────────
function decodeJwt(token: string): Record<string, any> {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

// ── GOOGLE SIGN-IN ────────────────────────────────────────────────────────────
declare global {
  interface Window {
    google: any;
    FB: any;
    fbAsyncInit?: () => void;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const FACEBOOK_APP_ID  = import.meta.env.VITE_FACEBOOK_APP_ID  as string | undefined;
const INSTAGRAM_CLIENT_ID = import.meta.env.VITE_INSTAGRAM_CLIENT_ID as string | undefined;

export const isGoogleConfigured    = !!GOOGLE_CLIENT_ID;
export const isFacebookConfigured  = !!FACEBOOK_APP_ID;
export const isInstagramConfigured = !!INSTAGRAM_CLIENT_ID;

// Trigger Google One-Tap / popup flow
export async function signInWithGoogle(): Promise<OAuthUser> {
  if (!GOOGLE_CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID not configured");

  await loadScript("https://accounts.google.com/gsi/client", "gsi-script");

  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        const payload = decodeJwt(response.credential);
        resolve({
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture,
          provider: "google",
        });
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Try One-Tap prompt; fall back to renderButton in a hidden container
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Create a hidden button container and click it
        let container = document.getElementById("__gsi_btn_container");
        if (!container) {
          container = document.createElement("div");
          container.id = "__gsi_btn_container";
          container.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:300px;height:44px;";
          document.body.appendChild(container);
        }
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: 300,
        });
        (container.querySelector("div[role=button]") as HTMLElement | null)?.click();
      }
    });

    // Safety timeout
    setTimeout(() => reject(new Error("Google sign-in timed out or was cancelled")), 120_000);
  });
}

// ── FACEBOOK LOGIN ────────────────────────────────────────────────────────────
export async function signInWithFacebook(): Promise<OAuthUser> {
  if (!FACEBOOK_APP_ID) throw new Error("VITE_FACEBOOK_APP_ID not configured");

  // Init FB SDK if not already done
  await new Promise<void>((resolve, reject) => {
    if (window.FB) { resolve(); return; }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
      resolve();
    };
    loadScript("https://connect.facebook.net/es_LA/sdk.js", "fb-sdk").catch(reject);
  });

  return new Promise((resolve, reject) => {
    window.FB.login(
      (response: any) => {
        if (response.status !== "connected") {
          reject(new Error("Facebook login cancelled"));
          return;
        }
        window.FB.api(
          "/me",
          { fields: "id,name,email,picture.type(large)" },
          (user: any) => {
            resolve({
              id: user.id,
              name: user.name,
              email: user.email,
              picture: user.picture?.data?.url,
              provider: "facebook",
            });
          }
        );
      },
      { scope: "email,public_profile" }
    );
  });
}

// ── INSTAGRAM OAuth (redirect-based) ─────────────────────────────────────────
export function signInWithInstagram() {
  if (!INSTAGRAM_CLIENT_ID) throw new Error("VITE_INSTAGRAM_CLIENT_ID not configured");

  const redirectUri = `${window.location.origin}/api/auth/instagram/callback`;
  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "user_profile,user_media",
    response_type: "code",
  });
  // Save current URL so we can return after login
  sessionStorage.setItem("ig_return", window.location.pathname);
  window.location.href = `https://api.instagram.com/oauth/authorize?${params}`;
}

// Check if we returned from Instagram callback (token stored by backend)
export function checkInstagramReturn(): OAuthUser | null {
  const raw = sessionStorage.getItem("ig_user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    sessionStorage.removeItem("ig_user");
    return { ...u, provider: "instagram" };
  } catch {
    return null;
  }
}
