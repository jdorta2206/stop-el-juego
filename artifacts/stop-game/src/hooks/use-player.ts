import { useState, useEffect } from "react";
import { AVATAR_COLORS, getApiUrl } from "@/lib/utils";

const SESSION_TOKEN_KEY = "stop_session_token";

/**
 * Silently restore the player profile from the backend session cookie
 * (or x-stop-token header fallback) on cold start. This solves the TWA
 * problem where the Android WebView wipes localStorage between cold starts,
 * forcing the user to re-login every time. The httpOnly cookie set by the
 * OAuth callback (and the bridge-stored token) is more durable than
 * app-readable localStorage, and the server can rebuild the profile from
 * the player_scores table via the playerId encoded in the signed cookie.
 */
async function tryRestoreSession(): Promise<PlayerProfile | null> {
  try {
    const apiBase = getApiUrl();
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
    if (!data?.id || !data?.name) return null;
    // Cache the refreshed token so subsequent calls can still authenticate
    // even if cookies get wiped before localStorage does.
    if (data.token) {
      try { localStorage.setItem(SESSION_TOKEN_KEY, data.token); } catch {}
    }
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
          setNeedsAuth(true);
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
    setNeedsAuth(true);
  };

  const showAuth = () => setNeedsAuth(true);

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth };
}
