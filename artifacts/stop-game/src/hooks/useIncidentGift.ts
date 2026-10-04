import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/utils";

const API = getApiUrl();
const TOKEN_KEY = "stop_session_token";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage?.getItem(TOKEN_KEY) || window.sessionStorage?.getItem(TOKEN_KEY);
  return token ? { "X-Stop-Token": token } : {};
}

export interface IncidentGift {
  coins: number;
  frame: string;
}

export interface IncidentGiftResult {
  claimable: boolean;
  gift: IncidentGift;
}

export function useIncidentGift(playerId?: string | null) {
  const [gift, setGift] = useState<IncidentGift | null>(null);
  const [claimable, setClaimable] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setGift(null);
      setClaimable(false);
      setClaimed(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/rewards/incident-gift`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as IncidentGiftResult;
      setGift(data.gift);
      setClaimable(data.claimable);
      setClaimed(!data.claimable);
    } catch {
      // The gift must never block the game if the endpoint is unavailable.
    }
  }, [playerId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const claim = useCallback(async () => {
    if (!playerId || !claimable || loading) return null;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/rewards/incident-gift/claim`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      setClaimable(false);
      setClaimed(true);
      return data as { ok: true; grantedCoins: number; grantedFrame: string };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [playerId, claimable, loading]);

  return { gift, claimable, claimed, loading, claim, refresh };
}
