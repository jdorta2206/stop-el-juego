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

export type CosmeticKind = "avatar" | "frame" | "background";
export type EquipKind = "avatar" | "frame" | "title" | "background";

export interface CosmeticMeta {
  id: string;
  kind: CosmeticKind;
  label: string;
  glyph: string;
  color?: string;
}

export interface ShopItem extends CosmeticMeta {
  price: number;
}

// Titles are earned by playing — the server returns the full catalog with each
// title's unlocked state so the UI can show locked ones as goals.
export interface TitleView {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  unlocked: boolean;
}

// Daily rotating deal — a shop item discounted today only. The server picks
// these deterministically from the UTC date and recomputes the price on buy.
export interface DailyDeal {
  id: string;
  originalPrice: number;
  price: number;
  discountPct: number;
}

export interface InventorySnapshot {
  coins: number;
  equipped: { avatar: string | null; frame: string | null; title: string | null; background: string | null };
  owned: { avatars: CosmeticMeta[]; frames: CosmeticMeta[]; backgrounds: CosmeticMeta[] };
  titles: TitleView[];
  shop: ShopItem[];
  dailyDeals?: DailyDeal[];
  dealsResetAt?: number;
}

export function useInventory(playerId?: string | null) {
  const [data, setData] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) { setData(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/inventory`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [playerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const equip = useCallback(async (kind: EquipKind, value: string | null) => {
    if (!playerId) return null;
    const res = await fetch(`${API}/api/inventory/equip`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ kind, value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || "Failed" };
    }
    await refresh();
    return res.json();
  }, [playerId, refresh]);

  const buy = useCallback(async (itemId: string) => {
    if (!playerId) return null;
    const res = await fetch(`${API}/api/inventory/buy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || "Failed" };
    }
    await refresh();
    return res.json();
  }, [playerId, refresh]);

  return { inventory: data, loading, refresh, equip, buy };
}
