import { useEffect, useState, useCallback, useRef } from "react";
import type { PlayerProfile } from "@/hooks/use-player";
import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();
const PING_INTERVAL = 30_000; // 30 seconds
const CHALLENGE_POLL_INTERVAL = 4_000; // 4 seconds

export interface OnlinePlayer {
  playerId: string;
  name: string;
  picture: string | null;
  equippedAvatar?: string | null;
  equippedFrame?: string | null;
  equippedTitle?: string | null;
  avatarColor: string;
  provider: string | null;
  roomCode: string | null;
  lastSeen: number;
}

export interface IncomingChallenge {
  challengeId: string;
  fromPlayerId: string;
  fromName: string;
  fromPicture: string | null;
  fromAvatarColor: string;
  roomCode: string;
  createdAt: number;
  isRoomInvite?: boolean;
}

// Send a heartbeat to mark this player as online
async function ping(player: PlayerProfile, roomCode?: string | null, language?: string) {
  try {
    await fetch(`${API_BASE}/api/presence/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        playerId: player.id,
        name: player.name,
        picture: (player as any).picture || null,
        avatarColor: player.avatarColor,
        provider: player.loginMethod || null,
        roomCode: roomCode || null,
        language: language || "es",
      }),
    });
  } catch {
    // Silent fail — presence is best-effort
  }
}

// Fetch current online players
export async function fetchOnlinePlayers(signal?: AbortSignal): Promise<OnlinePlayer[]> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/online`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.online || [];
  } catch {
    return [];
  }
}

// Send a challenge to another player, returns challengeId + roomCode
export async function sendChallenge(
  player: PlayerProfile,
  toPlayerId: string,
  language?: string
): Promise<{ challengeId: string; roomCode: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({
        fromPlayerId: player.id,
        fromName: player.name,
        fromPicture: (player as any).picture || null,
        fromAvatarColor: player.avatarColor,
        toPlayerId,
        language: language || "es",
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Respond to a challenge (accept or decline)
export async function respondToChallenge(
  challengeId: string,
  accepted: boolean
): Promise<{ roomCode: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/challenge/${challengeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ accepted }),
    });
    if (!res.ok) return { roomCode: null };
    return await res.json();
  } catch {
    return { roomCode: null };
  }
}

// Send a room invite to an online player (they can join directly, no accept/decline)
export async function sendRoomInvite(
  player: PlayerProfile,
  toPlayerId: string,
  roomCode: string,
  language?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/room-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromPlayerId: player.id,
        fromName: player.name,
        fromPicture: (player as any).picture || null,
        fromAvatarColor: player.avatarColor,
        toPlayerId,
        roomCode,
        language: language || "es",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Poll the status of a sent challenge
export async function pollChallengeStatus(
  challengeId: string,
  signal?: AbortSignal,
): Promise<{ status: "pending" | "accepted" | "declined" | "expired"; roomCode: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/presence/challenge/${challengeId}/status`, { signal });
    if (!res.ok) return { status: "expired", roomCode: "" };
    return await res.json();
  } catch {
    return { status: "expired", roomCode: "" };
  }
}

// Hook: sends heartbeat + returns live online players list + incoming challenges
export function usePresence(
  player: PlayerProfile | null,
  roomCode?: string | null,
  language?: string
) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const challengePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeChallenge = useRef<string | null>(null); // track if we're already showing one
  const refreshAbortRef = useRef<AbortController | null>(null);
  const challengeAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    try {
      const players = await fetchOnlinePlayers(controller.signal);
      if (!controller.signal.aborted) setOnlinePlayers(players);
    } catch {
      // Abort is expected when a newer refresh supersedes this one.
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
    }
  }, []);

  const pollChallenges = useCallback(async () => {
    if (!player || activeChallenge.current) return;
    challengeAbortRef.current?.abort();
    const controller = new AbortController();
    challengeAbortRef.current = controller;
    try {
      const res = await fetch(`${API_BASE}/api/presence/challenges/${player.id}`, { signal: controller.signal, headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const challenges: IncomingChallenge[] = data.challenges || [];
      if (challenges.length > 0) {
        activeChallenge.current = challenges[0].challengeId;
        setIncomingChallenge(challenges[0]);
      }
    } catch {
      // Abort is expected when a newer poll supersedes this one.
    } finally {
      if (challengeAbortRef.current === controller) challengeAbortRef.current = null;
    }
  }, [player?.id]);

  const dismissChallenge = useCallback(() => {
    activeChallenge.current = null;
    challengeAbortRef.current?.abort();
    setIncomingChallenge(null);
  }, []);

  useEffect(() => {
    if (!player) return;

    ping(player, roomCode, language);
    refresh();

    intervalRef.current = setInterval(() => {
      ping(player, roomCode, language);
      refresh();
    }, PING_INTERVAL);

    // Only poll for challenges when not in a room
    if (!roomCode) {
      challengePollRef.current = setInterval(pollChallenges, CHALLENGE_POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (challengePollRef.current) clearInterval(challengePollRef.current);
      refreshAbortRef.current?.abort();
      challengeAbortRef.current?.abort();
    };
  }, [player?.id, roomCode, language]);

  return { onlinePlayers, refresh, incomingChallenge, dismissChallenge };
}
