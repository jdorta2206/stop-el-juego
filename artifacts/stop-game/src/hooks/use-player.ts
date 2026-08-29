import { useState, useEffect } from "react";
import { AVATAR_COLORS, getApiUrl } from "@/lib/utils";

const SESSION_TOKEN_KEY = "stop_session_token";
const CANONICAL_API_ORIGIN = "https://www.stopjuegodepalabras.com";
const STORAGE_KEY = "stop_player_v2";
const OAUTH_ID_PREFIXES = ["google_", "fb_", "ig_", "apple_", "tt_"];
const PLAYER_EVENT = "stop:player-changed";

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
  loginMethod?: string | null;
  picture?: string | null;
  fbAccessToken?: string | null;
}

function isLoggedInId(id: string | null | undefined): boolean {
  return !!id && OAUTH_ID_PREFIXES.some((p) => id.startsWith(p));
}

function readStoredPlayer(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string" && parsed.name.trim()) {
      return {
        id: parsed.id,
        name: parsed.name.trim().slice(0, 14),
        avatarColor: parsed.avatarColor || AVATAR_COLORS[0],
        loginMethod: parsed.loginMethod ?? null,
        picture: parsed.picture ?? null,
        fbAccessToken: parsed.fbAccessToken ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredPlayer(profile: PlayerProfile | null) {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try { window.dispatchEvent(new CustomEvent(PLAYER_EVENT)); } catch {}
}

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
      name: String(data.name).trim().slice(0, 14),
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

  try {
    if (new URL(localBase, window.location.origin).origin !== CANONICAL_API_ORIGIN) {
      return await tryRestoreFrom(CANONICAL_API_ORIGIN);
    }
  } catch {}
  return null;
}

export function usePlayer() {
  // IMPORTANT: initialize synchronously from localStorage. This prevents the
  // login modal from being skipped while /api/auth/me is being checked.
  const [initialStored] = useState<PlayerProfile | null>(() => readStoredPlayer());
  const [player, setPlayer] = useState<PlayerProfile | null>(initialStored);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(!initialStored);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      const stored = readStoredPlayer();
      setPlayer(stored);
      setNeedsAuth(!stored);
    };

    // This flag used to suppress the registration UI after a previous
    // dismissal. Remove it so a visitor without a profile can register again.
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}

    const stored = readStoredPlayer();

    if (stored) {
      setPlayer(stored);
      setNeedsAuth(false);
      setIsLoaded(true);

      // Guest profiles are valid local profiles. Never validate them through
      // /api/auth/me because a 401 there simply means "not an OAuth session".
      if (isLoggedInId(stored.id)) {
        void (async () => {
          const restored = await tryRestoreSession();
          if (cancelled) return;
          if (restored) {
            writeStoredPlayer(restored);
            setPlayer(restored);
            setNeedsAuth(false);
          } else {
            // Keep the locally stored profile visible instead of deleting it.
            // The user can explicitly log out if they want to remove it.
            setPlayer(stored);
            setNeedsAuth(false);
          }
        })();
      }
    } else {
      // No local profile: the registration modal is already visible because
      // needsAuth starts as true. Check for an existing OAuth session in the
      // background; if none exists, leave the modal open.
      void (async () => {
        const restored = await tryRestoreSession();
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
    const clean: PlayerProfile = {
      id: String(profile.id || crypto.randomUUID()),
      name: String(profile.name || "").trim().slice(0, 14),
      avatarColor: profile.avatarColor || AVATAR_COLORS[0],
      loginMethod: profile.loginMethod ?? null,
      picture: profile.picture ?? null,
      fbAccessToken: profile.fbAccessToken ?? null,
    };

    // Never accept an empty name as a successful registration.
    if (!clean.name) return;

    writeStoredPlayer(clean);
    setPlayer(clean);
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
    setNeedsAuth(false);
  };

  const showAuth = () => {
    try { localStorage.removeItem("stop_auth_dismissed_v1"); } catch {}
    setNeedsAuth(true);
  };

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth, dismissAuth };
}
