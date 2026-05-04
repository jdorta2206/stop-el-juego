import { useState, useEffect } from "react";
import { AVATAR_COLORS } from "@/lib/utils";

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
    const refresh = () => {
      const stored = readStoredPlayer();
      setPlayer(stored);
      setNeedsAuth(!stored);
    };
    refresh();
    setIsLoaded(true);

    const handler = () => refresh();
    window.addEventListener(PLAYER_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
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
