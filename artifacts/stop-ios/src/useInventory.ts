import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

export type CosmeticKind = "avatar" | "frame" | "background";
export type EquipKind = CosmeticKind | "title";

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

export interface TitleView {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  unlocked: boolean;
}

export interface DailyDeal {
  id: string;
  originalPrice: number;
  price: number;
  discountPct: number;
}

export interface InventorySnapshot {
  coins: number;
  equipped: {
    avatar: string | null;
    frame: string | null;
    title: string | null;
    background: string | null;
  };
  owned: {
    avatars: CosmeticMeta[];
    frames: CosmeticMeta[];
    backgrounds: CosmeticMeta[];
  };
  titles: TitleView[];
  shop: ShopItem[];
  dailyDeals?: DailyDeal[];
  dealsResetAt?: number;
}

export function useInventory(playerId?: string | null) {
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setInventory(null);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<InventorySnapshot>("/api/inventory");
      setInventory(data);
    } catch {
      // The screen can remain usable while the API is temporarily unavailable.
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equip = useCallback(async (kind: EquipKind, value: string | null) => {
    if (!playerId) return null;
    return apiFetch<{ ok: boolean; kind: EquipKind; value: string | null }>(
      "/api/inventory/equip",
      {
        method: "POST",
        body: JSON.stringify({ kind, value }),
      },
    );
  }, [playerId]);

  const buy = useCallback(async (itemId: string) => {
    if (!playerId) return null;
    return apiFetch<{ ok: boolean; coins: number; item: ShopItem }>(
      "/api/inventory/buy",
      {
        method: "POST",
        body: JSON.stringify({ itemId }),
      },
    );
  }, [playerId]);

  return { inventory, loading, refresh, equip, buy };
}
