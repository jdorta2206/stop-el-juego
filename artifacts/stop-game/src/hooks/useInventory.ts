import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/utils";

const API = getApiUrl();
const TOKEN_KEY = "stop_session_token";
const PREVIEW_HEADERS = import.meta.env.VITE_HALLOWEEN_PREVIEW === "true" ? { "x-halloween-preview": "1" } : {};

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
  playerId: string;
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
  const [dataPlayerId, setDataPlayerId] = useState<string | null>(null);
  const [statusPlayerId, setStatusPlayerId] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [slowState, setSlowState] = useState(false);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const activePlayerIdRef = useRef(playerId);
  activePlayerIdRef.current = playerId;

  const refresh = useCallback(async () => {
    if (activePlayerIdRef.current !== playerId) return;
    if (!playerId) {
      refreshAbortRef.current?.abort();
      refreshAbortRef.current = null;
      setData(null);
      setDataPlayerId(null);
      setStatusPlayerId(null);
      setErrorState(null);
      setLoadingState(false);
      setSlowState(false);
      return;
    }
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setStatusPlayerId(playerId);
    setLoadingState(true);
    setErrorState(null);
    setSlowState(false);
    const slowTimer = window.setTimeout(() => {
      if (activePlayerIdRef.current === playerId && refreshAbortRef.current === controller) setSlowState(true);
    }, 3_000);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8_000);
    try {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        res = await fetch(API + "/api/inventory", {
          credentials: "include",
          headers: { ...authHeaders(), "X-Stop-Player-Id": playerId, ...(import.meta.env.VITE_HALLOWEEN_PREVIEW === "true" ? { "x-halloween-player-id": playerId } : {}), ...PREVIEW_HEADERS },
          signal: controller.signal,
        });
        if (res.status !== 503 || attempt === 2) break;
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
        if (controller.signal.aborted) {
          if (timedOut) {
            setErrorState("La tienda tardó más de 8 segundos en responder. Pulsa Reintentar.");
            setData(null);
            setDataPlayerId(null);
          }
          return;
        }
      }
      if (!res) throw new Error("Inventory request did not return a response");
      if (!res.ok) {
        if (!controller.signal.aborted) {
          const body = await res.json().catch(() => ({}));
          const message = res.status === 401
            ? "Inicia sesión para acceder a tu inventario y realizar compras."
            : res.status === 404
              ? "No se ha encontrado el inventario de este jugador."
              : res.status === 503
                ? "La tienda sigue ocupada. Pulsa Reintentar dentro de unos segundos."
                : body.error || "No se pudo cargar la tienda (HTTP " + res.status + ").";
          setErrorState(message);
          setData(null);
          setDataPlayerId(null);
        }
        return;
      }
      const snapshot = await res.json() as InventorySnapshot;
      if (snapshot?.playerId !== playerId) {
        throw new Error("Inventory response identity mismatch");
      }
      if (!controller.signal.aborted && activePlayerIdRef.current === playerId) {
        setData(snapshot);
        setDataPlayerId(snapshot.playerId);
        setErrorState(null);
      }
    } catch (error) {
      if (activePlayerIdRef.current !== playerId || refreshAbortRef.current !== controller) return;
      if (timedOut) {
        setErrorState("La tienda tardó más de 8 segundos en responder. Pulsa Reintentar.");
        setData(null);
        setDataPlayerId(null);
      } else if (!controller.signal.aborted) {
        setErrorState(error instanceof Error && error.message === "Inventory response identity mismatch"
          ? "La cuenta activa ha cambiado. Actualiza la tienda para cargar el inventario correcto."
          : "No se pudo conectar con la tienda. Comprueba tu conexión e inténtalo de nuevo.");
        setData(null);
        setDataPlayerId(null);
      }
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(slowTimer);
      if (refreshAbortRef.current === controller) {
        setSlowState(false);
        refreshAbortRef.current = null;
        setLoadingState(false);
      }
    }
  }, [playerId]);

  useEffect(() => {
    void refresh();
    return () => { refreshAbortRef.current?.abort(); };
  }, [refresh]);

  const equip = useCallback(async (kind: EquipKind, value: string | null) => {
    if (!playerId || activePlayerIdRef.current !== playerId) return null;
    const res = await fetch(`${API}/api/inventory/equip`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders(), "X-Stop-Player-Id": playerId },
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
    if (!playerId || activePlayerIdRef.current !== playerId) return null;
    const res = await fetch(`${API}/api/inventory/buy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders(), "X-Stop-Player-Id": playerId },
      body: JSON.stringify({ itemId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error || "Failed" };
    }
    await refresh();
    return res.json();
  }, [playerId, refresh]);

  const inventory = dataPlayerId === playerId ? data : null;
  const loading = !!playerId && (statusPlayerId !== playerId || loadingState);
  const error = statusPlayerId === playerId ? errorState : null;
  const slow = statusPlayerId === playerId && slowState;

  return { inventory, loading, error, slow, refresh, equip, buy };
}
