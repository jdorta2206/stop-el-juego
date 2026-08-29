import { useState, useEffect } from "react";
import { AVATAR_COLORS, getApiUrl } from "@/lib/utils";

const SESSION_TOKEN_KEY = "stop_session_token";
const CANONICAL_API_ORIGIN = "https://www.stopjuegodepalabras.com";

async function tryRestoreFrom(apiBase: string): Promise<PlayerProfile | null> {
  try {
    const headers: Record<string, string> = {};
    let token: string | null = null;
    try {
      token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (token) headers["x-stop-token"] = token;
    } catch {}

    const res = await fetch(`${apiBase}/api/auth/me`, {
      credentials: "include",
      headers,
      cache: "no-store",
    });

    if (res.status === 401) {
      if (token) {
        try { localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}
      }
      return null;
    }
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.id || !data.name) return null;
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

async function tryRestoreSession(): Promise<PlayerProfile | null> {
  const localBase = getApiUrl();
  const restored = await tryRestoreFrom(localBase);
  if (restored) return restored;

  // The canonical web origin is the final fallback. This protects against
  // stale VITE_API_URL values, old bookmarks, and deployments that temporarily
  // resolve the API through a different origin.
  try {
    if (new URL(localBase, window.location.origin).origin !== CANONICAL_API_ORIGIN) {
      return await tryRestoreFrom(CANONICAL_API_ORIGIN);
    }
  } catch {}
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
      if (stored && !isLoggedInId(stored.id)) {
        writeStoredPlayer(null);
        setPlayer(null);
        setNeedsAuth(true);
        return;
      }
      setPlayer(stored);
      setNeedsAuth(!stored);
    };

    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}

    const stored = readStoredPlayer();
    if (stored && !isLoggedInId(stored.id)) {
      writeStoredPlayer(null);
      setPlayer(null);
      setNeedsAuth(true);
      setIsLoaded(true);
    } else if (stored) {
      setPlayer(stored);
      setNeedsAuth(false);
      setIsLoaded(true);

      void (async () => {
        const restored = await tryRestoreSession();
        if (cancelled) return;
        if (restored) {
          writeStoredPlayer(restored);
          setPlayer(restored);
          setNeedsAuth(false);
          return;
        }
        // A stale locally stored OAuth profile must not hide the login modal.
        writeStoredPlayer(null);
        setPlayer(null);
        setNeedsAuth(true);
      })();
    } else {
      void (async () => {
        const restored = await tryRestoreSession();
        if (cancelled) return;
        if (restored) {
          writeStoredPlayer(restored);
          setPlayer(restored);
          setNeedsAuth(false);
        } else {
          // 401 means there is no authenticated account. Explicitly expose the
          // AuthModal instead of leaving the UI in an anonymous-but-loaded state.
          setPlayer(null);
          setNeedsAuth(true);
        }
        setIsLoaded(true);
      })();
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
    savePlayer({ ...current, ...updates });
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
    try {
      const b = getApiUrl();
      if (b) origins.add(new URL(b, window.location.origin).origin);
    } catch {}
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
    // Dismissing only affects the current render. It is never persisted.
    setNeedsAuth(false);
  };

  const showAuth = () => {
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    setNeedsAuth(true);
  };

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth, dismissAuth };
}
