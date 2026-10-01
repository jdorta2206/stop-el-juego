import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/utils";

const API = getApiUrl();
const TOKEN_KEY = "stop_session_token";

/**
 * Auth strategy: the API issues an httpOnly cookie on OAuth callback, which
 * is the primary auth source (durable across tabs / browser restarts via
 * `credentials: include`). The X-Stop-Token header from localStorage is a
 * cross-origin fallback for environments where third-party cookies are
 * blocked. We never gate calls on the header alone — the cookie may be
 * present even when localStorage is empty.
 */
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const tok =
    window.localStorage?.getItem(TOKEN_KEY) ||
    window.sessionStorage?.getItem(TOKEN_KEY);
  return tok ? { "X-Stop-Token": tok } : {};
}

export type Mission = {
  id: string;
  type: string;
  target: number;
  xpReward: number;
  i18nKey: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type TierReward = {
  tier: number;
  free: { kind: "coins" | "avatar" | "frame"; value: string | number; label: string };
  premium: { kind: "coins" | "avatar" | "frame"; value: string | number; label: string };
};

export type SeasonInfo = {
  id: number;
  startDate: string;
  endDate: string;
  theme: { name?: string; color?: string; emoji?: string; tagline?: string };
  totalTiers: number;
  tiers: TierReward[];
  /**
   * Multiplier applied server-side to mission XP for premium subscribers.
   * Surfaced here so the UI never hardcodes the value and never drifts from
   * what the server actually pays out.
   */
  premiumMissionMultiplier?: number;
};

export type CosmeticMeta = {
  id: string;
  kind: "avatar" | "frame" | "coin_pack";
  label: string;
  glyph?: string;
  color?: string;
};

export type PendingFinal = {
  seasonId: number;
  finalRank: number;
  finalXp: number;
  totalPlayers: number;
  awardedCosmetic: CosmeticMeta | null;
  seasonName: string | null;
};

export type SeasonProgress = {
  seasonId: number;
  xp: number;
  currentTier: number;
  totalTiers: number;
  claimedTiers: { free: number[]; premium: number[] };
  missions: Mission[];
  missionsDate: string;
  hasUnclaimedMissions: boolean;
  pendingFinal: PendingFinal | null;
};

export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  avatarColor: string;
  isPremium: boolean;
  equippedAvatar: string | null;
  equippedFrame: string | null;
  xp: number;
};

export type Leaderboard = {
  seasonId: number;
  total: number;
  top: LeaderboardEntry[];
  me: (LeaderboardEntry & { inTop: boolean }) | null;
};

export function useSeason(playerId?: string | null) {
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [progress, setProgress] = useState<SeasonProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetch(`${API}/api/season/current`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
        playerId
          ? fetch(`${API}/api/season/progress`, {
              credentials: "include",
              headers: authHeaders(),
              signal: controller.signal,
            }).then((r) => (r.ok ? r.json() : null))
          : Promise.resolve(null),
      ]);
      if (s) setSeason(s);
      if (p) setProgress(p);
    } catch (error) {
      if (controller.signal.aborted) return;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [playerId]);

  useEffect(() => () => { requestRef.current?.abort(); }, [playerId]);
  useEffect(() => { refresh(); }, [refresh]);

  const claimMission = useCallback(async (missionId: string) => {
    if (!playerId) return null;
    const res = await fetch(`${API}/api/season/claim-mission`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ missionId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await refresh();
    return data;
  }, [playerId, refresh]);

  const ackFinal = useCallback(async (seasonId: number) => {
    if (!playerId) return;
    try {
      await fetch(`${API}/api/season/ack-final`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ seasonId }),
      });
      // Optimistically clear locally so the modal doesn't reopen on re-render.
      setProgress((prev) => (prev ? { ...prev, pendingFinal: null } : prev));
    } catch { /* ignore */ }
  }, [playerId]);

  const claimTier = useCallback(async (tier: number, track: "free" | "premium") => {
    if (!playerId) return null;
    const res = await fetch(`${API}/api/season/claim-tier`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ tier, track }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || "Failed" };
    }
    const data = await res.json();
    await refresh();
    return data;
  }, [playerId, refresh]);

  return { season, progress, loading, refresh, claimMission, claimTier, ackFinal };
}

/**
 * Fetches the season leaderboard. Public endpoint — viewer's row is included
 * automatically when an auth session is present.
 */
export function useSeasonLeaderboard(seasonId?: number | null, enabled: boolean = true) {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const leaderboardAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    leaderboardAbortRef.current?.abort();
    if (!enabled) return;
    const controller = new AbortController();
    leaderboardAbortRef.current = controller;
    setLoading(true);
    try {
      const url = new URL(`${API}/api/season/leaderboard`);
      if (seasonId) url.searchParams.set("seasonId", String(seasonId));
      const r = await fetch(url.toString(), {
        credentials: "include",
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (r.ok && !controller.signal.aborted) setData(await r.json());
    } catch {
      /* ignore */
    } finally {
      if (leaderboardAbortRef.current === controller) {
        leaderboardAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [seasonId, enabled]);

  useEffect(() => {
    void refresh();
    return () => leaderboardAbortRef.current?.abort();
  }, [refresh]);

  return { data, loading, refresh };
}

/**
 * Reports a gameplay event to the season pass mission tracker. Fire-and-forget.
 * No-op for guests. Authenticated via httpOnly cookie (or X-Stop-Token header
 * fallback); the server returns 401 silently if neither is present.
 */
/**
 * Deprecated compatibility helper.
 * Season progress is now recorded exclusively from server-authoritative
 * gameplay results (score submission, multiplayer finalization and Daily).
 * Keeping this function as a no-op prevents legacy callers from generating
 * expected-but-noisy 410 requests against the closed client event endpoint.
 */
export async function reportSeasonEvent(
  _playerId: string | null | undefined,
  _type: "win_game" | "play_game" | "round_score" | "streak" | "valid_words" | "daily_done",
  _value?: number,
): Promise<void> {
  return;
}
