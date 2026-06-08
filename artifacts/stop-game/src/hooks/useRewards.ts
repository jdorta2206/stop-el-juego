import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/utils";

const API = getApiUrl();
const TOKEN_KEY = "stop_session_token";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const tok =
    window.localStorage?.getItem(TOKEN_KEY) ||
    window.sessionStorage?.getItem(TOKEN_KEY);
  return tok ? { "X-Stop-Token": tok } : {};
}

// Mirrors the server shapes in collectionSets.ts / prestigeRewards.ts.
export interface SetReward {
  coins?: number;
  frame?: string;
}

export interface CollectionSetView {
  id: string;
  label: string;
  icon: string;
  desc: string;
  progress: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  reward: SetReward;
}

export interface CollectionRewards {
  stats: { total: number; byRarity: Record<string, number>; distinctCategories: number };
  sets: CollectionSetView[];
}

export interface PrestigeMilestoneView {
  tier: number;
  label: string;
  reward: { coins: number; frame: string | null };
  reached: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface PrestigeRewards {
  current: number;
  milestones: PrestigeMilestoneView[];
}

export interface ClaimResult {
  ok?: boolean;
  coins?: number;
  grantedCoins?: number;
  grantedFrame?: string | null;
  error?: string;
}

/**
 * Loads the player's collection-set + prestige reward status and exposes claim
 * actions. After a successful claim, callers should refresh their inventory so
 * the new coins/frames appear (pass an onClaimed callback for that).
 */
export function useRewards(playerId?: string | null, onClaimed?: () => void) {
  const [collection, setCollection] = useState<CollectionRewards | null>(null);
  const [prestige, setPrestige] = useState<PrestigeRewards | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) { setCollection(null); setPrestige(null); return; }
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch(`${API}/api/rewards/collection`, { credentials: "include", headers: authHeaders() }),
        fetch(`${API}/api/rewards/prestige`, { credentials: "include", headers: authHeaders() }),
      ]);
      if (c.ok) setCollection(await c.json());
      if (p.ok) setPrestige(await p.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [playerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const claim = useCallback(async (path: string, body: object): Promise<ClaimResult> => {
    if (!playerId) return { error: "No player" };
    try {
      const res = await fetch(`${API}/api/rewards/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as ClaimResult;
      if (!res.ok) return { error: json.error || "Failed" };
      await refresh();
      onClaimed?.();
      return json;
    } catch {
      return { error: "Failed" };
    }
  }, [playerId, refresh, onClaimed]);

  const claimCollection = useCallback(
    (setId: string) => claim("collection/claim", { setId }),
    [claim],
  );
  const claimPrestige = useCallback(
    (tier: number) => claim("prestige/claim", { tier }),
    [claim],
  );

  return { collection, prestige, loading, refresh, claimCollection, claimPrestige };
}
