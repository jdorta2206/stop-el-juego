import { useEffect, useState, useCallback, useRef } from "react";
import type { PlayerProfile } from "@/hooks/use-player";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PING_INTERVAL = 30_000; // 30 seconds

export interface OnlinePlayer {
  playerId: string;
  name: string;
  picture: string | null;
  avatarColor: string;
  provider: string | null;
  roomCode: string | null;
  lastSeen: number;
}

// Send a heartbeat to mark this player as online
async function ping(player: PlayerProfile, roomCode?: string | null) {
  try {
    await fetch(`${API_BASE}/api/presence/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        name: player.name,
        picture: (player as any).picture || null,
        avatarColor: player.avatarColor,
        provider: player.loginMethod || null,
        roomCode: roomCode || null,
      }),
    });
  } catch {
    // Silent fail — presence is best-effort
  }
}

// Fetch current online players
export async function fetchOnlinePlayers(): Promise<OnlinePlayer[]> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/online`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.online || [];
  } catch {
    return [];
  }
}

// Hook: sends heartbeat + returns live online players list
export function usePresence(
  player: PlayerProfile | null,
  roomCode?: string | null
) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const players = await fetchOnlinePlayers();
    setOnlinePlayers(players);
  }, []);

  useEffect(() => {
    if (!player) return;

    // Send immediate ping
    ping(player, roomCode);
    refresh();

    // Set up recurring ping + refresh
    intervalRef.current = setInterval(() => {
      ping(player, roomCode);
      refresh();
    }, PING_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [player?.id, roomCode]);

  return { onlinePlayers, refresh };
}
