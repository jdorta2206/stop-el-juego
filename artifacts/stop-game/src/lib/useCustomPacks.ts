import { useCallback, useEffect, useState } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";

const API_BASE = getApiUrl();

export interface CustomPack {
  id: number;
  playerId: string;
  name: string;
  icon: string;
  color: string;
  language: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomPackInput {
  name: string;
  icon: string;
  color: string;
  language: string;
  categories: string[];
}

// Custom event other components fire after create/edit/delete so any mounted
// useCustomPacks hook refetches immediately — keeps PackSelector and the
// manager modal in sync without prop drilling.
export const CUSTOM_PACKS_REFRESH_EVENT = "stop:custom-packs-refresh";
export function notifyCustomPacksRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CUSTOM_PACKS_REFRESH_EVENT));
  }
}

export function useCustomPacks(playerId: string | null | undefined) {
  const [packs, setPacks] = useState<CustomPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(CUSTOM_PACKS_REFRESH_EVENT, h);
    return () => window.removeEventListener(CUSTOM_PACKS_REFRESH_EVENT, h);
  }, []);

  useEffect(() => {
    if (!playerId) {
      setPacks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/custom-packs/${encodeURIComponent(playerId)}`, {
      credentials: "include",
      headers: { ...authHeaders() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPacks(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { packs, loading, error, reload };
}

export async function createCustomPack(playerId: string, input: CustomPackInput) {
  const res = await fetch(`${API_BASE}/api/custom-packs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ playerId, ...input }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  notifyCustomPacksRefresh();
  return (await res.json()).data as CustomPack;
}

export async function updateCustomPack(
  id: number,
  playerId: string,
  input: CustomPackInput,
) {
  const res = await fetch(`${API_BASE}/api/custom-packs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ playerId, ...input }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  notifyCustomPacksRefresh();
  return (await res.json()).data as CustomPack;
}

export async function deleteCustomPack(id: number, playerId: string) {
  const res = await fetch(
    `${API_BASE}/api/custom-packs/${id}?playerId=${encodeURIComponent(playerId)}`,
    { method: "DELETE", credentials: "include", headers: { ...authHeaders() } },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  notifyCustomPacksRefresh();
}
