import { useState, useEffect } from "react";
import { AVATAR_COLORS } from "@/lib/utils";

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
  loginMethod?: string | null;
}

const STORAGE_KEY = "stop_player_v2";

export function usePlayer() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id && parsed.name) {
          setPlayer(parsed);
          setNeedsAuth(false);
        } else {
          setNeedsAuth(true);
        }
      } catch {
        setNeedsAuth(true);
      }
    } else {
      setNeedsAuth(true);
    }
    setIsLoaded(true);
  }, []);

  const savePlayer = (profile: PlayerProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setPlayer(profile);
    setNeedsAuth(false);
  };

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!player) return;
    const updated = { ...player, ...updates };
    savePlayer(updated);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
    setNeedsAuth(true);
  };

  const showAuth = () => setNeedsAuth(true);

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, logout, showAuth };
}
