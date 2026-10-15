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
      headers: { ...authHeaders(), "x-halloween-player-id": playerId, ...(import.meta.env.VITE_HALLOWEEN_PREVIEW === "true" ? { "x-halloween-preview": "1" } : {}) },
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
        headers: { "Content-Type": "application/json", ...authHeaders(), "x-halloween-player-id": playerId, ...(import.meta.env.VITE_HALLOWEEN_PREVIEW === "true" ? { "x-halloween-preview": "1" } : {}) },
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

async function reportHalloweenDiagnostic(eventName: string, metadata: Record<string, unknown>) {
  try {
    await fetch(`${getApiUrl()}/api/analytics/event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ eventName, metadata }),
    });
  } catch {
    // Diagnostics must never interrupt gameplay or Halloween progress.
  }
}

export async function reportHalloweenEvent(
  playerId: string,
  type: "game_completed" | "scare_received" | "scare_provoked",
  eventKey: string,
) {
  if (!playerId || !isHalloweenActive()) return null;
  if (type !== "scare_received" && type !== "scare_provoked") return null;
  const diagnostic = { type, eventKey: eventKey.slice(0, 160) };
  void reportHalloweenDiagnostic("halloween_scare_seen", diagnostic);
  void reportHalloweenDiagnostic("halloween_scare_report_attempt", diagnostic);
  try {
    const r = await fetch(`${getApiUrl()}/api/halloween/event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders(), "x-halloween-player-id": playerId, ...(import.meta.env.VITE_HALLOWEEN_PREVIEW === "true" ? { "x-halloween-preview": "1" } : {}) },
      body: JSON.stringify({ type, eventKey }),
    });
    if (!r.ok) {
      void reportHalloweenDiagnostic("halloween_scare_report_failed", { ...diagnostic, httpStatus: r.status });
      return null;
    }
    const result = await r.json();
    void reportHalloweenDiagnostic("halloween_scare_report_saved", diagnostic);
    return result;
  } catch {
    void reportHalloweenDiagnostic("halloween_scare_report_failed", { ...diagnostic, httpStatus: 0, reason: "network_error" });
    return null;
  }
}
