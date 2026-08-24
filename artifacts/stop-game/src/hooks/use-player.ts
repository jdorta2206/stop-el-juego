import { useState, useEffect } from "react";
import { AVATAR_COLORS, getApiUrl } from "@/lib/utils";

const SESSION_TOKEN_KEY = "stop_session_token";

// Production is now unified on the public Railway domain. Do not fall back to
// the retired Replit host: doing so creates failed cross-origin auth requests
// and can leave the web app with a stale session source.
const CANONICAL_API_ORIGIN = "https://www.stopjuegodepalabras.com";

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
    if (data.token) {
      try { localStorage.setItem(SESSION_TOKEN_KEY, data.token); } catch {}
    }
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

/** Restore the player from the current production origin, with the canonical
 * domain as a fallback only when the configured API is genuinely different. */
async function tryRestoreSession(): Promise<PlayerProfile | null> {
  const localBase = getApiUrl();
  const sameOrigin = await tryRestoreFrom(localBase);
  if (sameOrigin) return sameOrigin;
  try {
    if (typeof window !== "undefined" && new URL(localBase).origin !== CANONICAL_API_ORIGIN) {
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
const OAUTH_ID_PREFIXES = ["google_", "fb_", "ig_", "apple_", "tt_"];
function isLoggedInId(id: string | null | undefined): boolean {
  return !!id && OAUTH_ID_PREFIXES.some((p) => id.startsWith(p));
}

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
      setPlayer(stored);
      setNeedsAuth(false);
      setIsLoaded(true);
      if (isLoggedInId(stored.id)) {
        // A stale local profile must not masquerade as an authenticated account.
        // Restore the signed session immediately; on a confirmed failed restore,
        // clear the stale identity so protected endpoints don't loop on 401/403.
        void tryRestoreSession().then((restored) => {
          if (cancelled) return;
          if (restored) {
            writeStoredPlayer(restored);
            setPlayer(restored);
            setNeedsAuth(false);
            return;
          }
          try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}
          writeStoredPlayer(null);
          setPlayer(null);
          setNeedsAuth(true);
        });
      }
    } else {
      tryRestoreSession().then((restored) => {
        if (cancelled) return;
        if (restored) {
          writeStoredPlayer(restored);
          setPlayer(restored);
          setNeedsAuth(false);
        } else {
          setPlayer(null);
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
    const origins = new Set<string>();
    try { origins.add(window.location.origin); } catch {}
    try { const b = getApiUrl(); if (b) origins.add(new URL(b, window.location.origin).origin); } catch {}
    origins.add(CANONICAL_API_ORIGIN);
    for (const origin of origins) {
      try {
        void fetch(`${origin}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }

    writeStoredPlayer(null);
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}

    try {
      window.location.href = import.meta.env.BASE_URL || "/";
    } catch {
      setPlayer(null);
      setNeedsAuth(true);
    }
  };

  const dismissAuth = () => {
    try { localStorage.setItem("stop_auth_dismissed_v1", "1"); } catch {}
    setNeedsAuth(false);
  };

  const showAuth = () => {
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    setNeedsAuth(true);
  };

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth, dismissAuth };
}
