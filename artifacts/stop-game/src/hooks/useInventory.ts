import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "@/lib/utils";
import { isHalloweenPreview } from "@/lib/halloweenEvent";

const API = getApiUrl();
const TOKEN_KEY = "stop_session_token";

const HALLOWEEN_PREVIEW_ITEMS: ShopItem[] = [
  { id: "avatar_halloween_ghost", kind: "avatar", label: "Fantasmita", glyph: "👻", price: 1500 },
  { id: "avatar_halloween_pumpkin", kind: "avatar", label: "Calabaza Maldita", glyph: "🎃", price: 2000 },
  { id: "avatar_halloween_vampire", kind: "avatar", label: "Vampiro", glyph: "🧛", price: 2500 },
  { id: "avatar_halloween_witch", kind: "avatar", label: "Brujita", glyph: "🧙‍♀️", price: 3000 },
  { id: "frame_halloween_web", kind: "frame", label: "Marco Telaraña", glyph: "🕸️", price: 2500 },
  { id: "bg_halloween_cemetery", kind: "background", label: "Fondo Cementerio", glyph: "🪦", price: 4000 },
];

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

// Weekly rotating storefront. The server selects the current catalogue slice
// deterministically and recomputes deal prices on every purchase.
export interface WeeklyDeal {
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
  weeklyShop?: ShopItem[];
  weeklyDeals?: WeeklyDeal[];
  shopResetAt?: number;
  shopWeekKey?: string;
}

export function useInventory(playerId?: string | null) {
  const [data, setData] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (isHalloweenPreview()) {
      setData((current) => current ?? {
        coins: 10000,
        equipped: { avatar: null, frame: null, title: null, background: null },
        owned: { avatars: [], frames: [], backgrounds: [] },
        titles: [],
        shop: HALLOWEEN_PREVIEW_ITEMS,
        weeklyShop: [],
        weeklyDeals: [],
      });
      return;
    }
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
    if (isHalloweenPreview()) {
      setData((current) => current ? { ...current, equipped: { ...current.equipped, [kind]: value } } : current);
      return { ok: true, preview: true };
    }
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
    if (isHalloweenPreview() && itemId.includes("_halloween_")) {
      setData((current) => {
        if (!current) return current;
        const item = current.shop.find((entry) => entry.id === itemId);
        if (!item || current.coins < item.price) return current;
        const ownedKey = item.kind === "avatar" ? "avatars" : item.kind === "frame" ? "frames" : "backgrounds";
        if (current.owned[ownedKey].some((entry) => entry.id === itemId)) return current;
        return {
          ...current,
          coins: current.coins - item.price,
          owned: { ...current.owned, [ownedKey]: [...current.owned[ownedKey], item] },
        };
      });
      return { ok: true, preview: true };
    }
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
