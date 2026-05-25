import { useState, useEffect } from "react";
import { AVATAR_COLORS, getApiUrl } from "@/lib/utils";

const SESSION_TOKEN_KEY = "stop_session_token";

// Canonical OAuth domain. The Google/Facebook/Instagram consoles only know
// about this host, so OAuth always sets the session cookie here even when
// the user originally came from the TWA domain (stopjuegodepalabras.com).
// We try the user's current origin first (same-site, cookie always rides),
// then fall back to canonical with credentials:include so the cookie set
// by a previous OAuth on the canonical domain still restores the session
// across domains. The cookie's sameSite="none" makes this fetch work.
const CANONICAL_API_ORIGIN = "https://stop-el-juego.replit.app";

async function tryRestoreFrom(apiBase: string): Promise<PlayerProfile | null> {
  try {
    const headers: Record<string, string> = {};
    try {
      const tok = localStorage.getItem(SESSION_TOKEN_KEY);
      if (tok) headers["x-stop-token"] = tok;
    } catch {}
    const res = await fetch(`${apiBase}/api/auth/me`, {
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.id) return null;
    // Cache the refreshed token so subsequent same-origin calls authenticate
    // via x-stop-token header even if the cross-domain cookie gets wiped.
    if (data.token) {
      try { localStorage.setItem(SESSION_TOKEN_KEY, data.token); } catch {}
    }
    // If /me returns id but no name (logged in via OAuth, never finished
    // profile setup), don't return — let the modal show so they can pick
    // a name. Caller treats null as "no usable session".
    if (!data.name) return null;
    return {
      id: data.id,
      name: data.name,
      avatarColor: data.avatarColor || AVATAR_COLORS[0],
      loginMethod: data.loginMethod ?? null,
      picture: data.picture ?? null,
      fbAccessToken: null,
    };
  } catch {
    return null;
  }
}

/**
 * Silently restore the player profile on cold start. Tries the current
 * origin first (works when the user is already on the canonical domain or
 * when the cookie is present on whichever domain they're on), then falls
 * back to the canonical OAuth domain so users who logged in there but
 * cold-start the TWA on stopjuegodepalabras.com still get auto-signed-in.
 * The canonical fetch uses credentials:include + sameSite="none" cookies,
 * so the existing httpOnly session cookie set during OAuth is sent across
 * origins and the profile is rebuilt without re-login.
 */
async function tryRestoreSession(): Promise<PlayerProfile | null> {
  const localBase = getApiUrl();
  const sameOrigin = await tryRestoreFrom(localBase);
  if (sameOrigin) return sameOrigin;
  // Only try canonical when it's actually different from current origin —
  // avoids a wasted duplicate fetch when the user is already on canonical.
  try {
    if (typeof window !== "undefined" &&
        new URL(localBase).origin !== CANONICAL_API_ORIGIN) {
      return await tryRestoreFrom(CANONICAL_API_ORIGIN);
    }
  } catch { /* malformed URL — ignore */ }
  return null;
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
  loginMethod?: string | null;
  picture?: string | null;
  fbAccessToken?: string | null;
}

const STORAGE_KEY = "stop_player_v2";

// 🔄 Cross-component sync: every mounted `usePlayer` instance had its own
// useState, so a rename in <Layout> never reached <Multiplayer> until that
// page remounted. The join request kept sending the old name and the server's
// new unique-name guard rejected it as a duplicate. We solve this with a tiny
// pub/sub: writers dispatch `player-changed`, all hooks re-read from storage.
const PLAYER_EVENT = "stop:player-changed";

function readStoredPlayer(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.name) return parsed as PlayerProfile;
    return null;
  } catch {
    return null;
  }
}

function writeStoredPlayer(profile: PlayerProfile | null) {
  if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(STORAGE_KEY);
  // Notify every hook instance in this tab. The native `storage` event only
  // fires across tabs, so we use a custom event for the same-tab case.
  window.dispatchEvent(new CustomEvent(PLAYER_EVENT));
}

export function usePlayer() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      const stored = readStoredPlayer();
      setPlayer(stored);
      setNeedsAuth(!stored);
    };

    const stored = readStoredPlayer();
    if (stored) {
      // Already have a local profile → no network needed.
      setPlayer(stored);
      setNeedsAuth(false);
      setIsLoaded(true);
    } else {
      // No localStorage profile (first visit, or TWA wiped storage).
      // Try to silently restore from the long-lived backend session before
      // showing the login modal. This is the key fix: if the user had ever
      // logged in (Google/Facebook/Instagram/Apple/TikTok), the server still
      // recognizes their signed cookie/token and rebuilds their profile.
      tryRestoreSession().then((restored) => {
        if (cancelled) return;
        if (restored) {
          writeStoredPlayer(restored);
          setPlayer(restored);
          setNeedsAuth(false);
        } else {
          setPlayer(null);
          // 🚦 Respect a "dismissed" flag so users who chose to browse
          // anonymously aren't gated again on every navigation/cold start.
          // The flag is cleared on logout and on any explicit showAuth()
          // call (gated action like multiplayer/save score).
          let dismissed = false;
          try { dismissed = localStorage.getItem("stop_auth_dismissed_v1") === "1"; } catch {}
          setNeedsAuth(!dismissed);
        }
        setIsLoaded(true);
      });
    }

    const handler = () => refresh();
    window.addEventListener(PLAYER_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PLAYER_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const savePlayer = (profile: PlayerProfile) => {
    writeStoredPlayer(profile);
    setPlayer(profile);
    setNeedsAuth(false);
  };

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    const current = player ?? readStoredPlayer();
    if (!current) return;
    const updated = { ...current, ...updates };
    savePlayer(updated);
  };

  const saveFbToken = (token: string) => {
    const current = player ?? readStoredPlayer();
    if (!current) return;
    const updated = { ...current, fbAccessToken: token };
    writeStoredPlayer(updated);
    setPlayer(updated);
  };

  const logout = () => {
    writeStoredPlayer(null);
    setPlayer(null);
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    setNeedsAuth(true);
  };

  // Dismiss the auth modal and remember that choice so we don't gate
  // navigation again on this device until the user logs out or hits a
  // gated action.
  const dismissAuth = () => {
    try { localStorage.setItem("stop_auth_dismissed_v1", "1"); } catch {}
    setNeedsAuth(false);
  };

  // Force the auth modal open (used by gated actions like create-room,
  // join-tournament, save-score). Clears the dismissed flag so it actually
  // re-renders the modal.
  const showAuth = () => {
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    setNeedsAuth(true);
  };

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth, dismissAuth };
}
