import { useCallback, useEffect, useState } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import { isHalloweenActive } from "@/lib/halloweenEvent";

export type HalloweenProgress = {
  gamesCompleted: number;
  scaresReceived: number;
  scaresProvoked: number;
  coinsEarned: number;
  rewards: string[];
};

type HalloweenProgressResponse = {
  active: boolean;
  year: number;
  progress: HalloweenProgress | null;
};

export function useHalloweenProgress(playerId?: string | null) {
  const [data, setData] = useState<HalloweenProgressResponse | null>(null);

  useEffect(() => {
    if (!playerId || !isHalloweenActive()) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetch(`${getApiUrl()}/api/halloween/progress`, {
      credentials: "include",
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((next) => {
        if (!cancelled && next) setData(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [playerId]);

  const report = useCallback(async (
    type: "game_completed" | "scare_received" | "scare_provoked",
    eventKey: string,
  ) => {
    if (!playerId || !isHalloweenActive()) return null;
    try {
      const r = await fetch(`${getApiUrl()}/api/halloween/event`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ type, eventKey }),
      });
      if (!r.ok) return null;
      const next = await r.json();
      setData({ active: true, year: next.year, progress: {
        gamesCompleted: next.gamesCompleted,
        scaresReceived: next.scaresReceived,
        scaresProvoked: next.scaresProvoked,
        coinsEarned: next.coinsEarned,
        rewards: next.rewards ?? [],
      }});
      return next;
    } catch {
      return null;
    }
  }, [playerId]);

  return { data, report };
}

export async function reportHalloweenEvent(
  playerId: string,
  type: "game_completed" | "scare_received" | "scare_provoked",
  eventKey: string,
) {
  if (!playerId || !isHalloweenActive()) return null;
  try {
    const r = await fetch(`${getApiUrl()}/api/halloween/event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ type, eventKey }),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
