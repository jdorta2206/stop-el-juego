import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { AVATAR_COLORS } from "@/lib/utils";

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
}

export function usePlayer() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("stop_player_profile");
    if (stored) {
      try {
        setPlayer(JSON.parse(stored));
      } catch (e) {
        createNewPlayer();
      }
    } else {
      createNewPlayer();
    }
    setIsLoaded(true);
  }, []);

  const createNewPlayer = () => {
    const newPlayer: PlayerProfile = {
      id: uuidv4(),
      name: `Jugador${Math.floor(Math.random() * 10000)}`,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };
    savePlayer(newPlayer);
  };

  const savePlayer = (profile: PlayerProfile) => {
    localStorage.setItem("stop_player_profile", JSON.stringify(profile));
    setPlayer(profile);
  };

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!player) return;
    const updated = { ...player, ...updates };
    savePlayer(updated);
  };

  return { player, isLoaded, updateProfile };
}
