import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import {
  type CollectionMap,
  type CollectedWord,
  mergeDiscoveries,
} from "@/lib/collection";

// Namespace local cache by playerId so switching accounts on the same
// device never mixes collections (and never propagates another player's
// words up to this player's server row).
const LEGACY_KEY = "stop_collection_v1";
function localKey(playerId?: string) {
  return playerId ? `stop_collection_v1:${playerId}` : "stop_collection_v1:guest";
}

function loadLocal(playerId?: string): CollectionMap {
  try {
    const raw = localStorage.getItem(localKey(playerId));
    return raw ? (JSON.parse(raw) as CollectionMap) : {};
  } catch { return {}; }
}

function saveLocal(playerId: string | undefined, c: CollectionMap) {
  try { localStorage.setItem(localKey(playerId), JSON.stringify(c)); } catch {}
}

// One-time migration: if the player has a legacy unscoped cache and no
// scoped cache yet, move it under their key. Idempotent.
function migrateLegacy(playerId?: string) {
  if (!playerId) return;
  try {
    const scopedKey = localKey(playerId);
    if (localStorage.getItem(scopedKey)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;

    // The legacy cache had no owner identity. Never attribute it to the
    // currently logged-in account unless the persisted player identity proves
    // that the cache belongs to that same account.
    const rawPlayer = localStorage.getItem("stop_player_v2");
    let storedPlayerId: string | null = null;
    try {
      const parsed = rawPlayer ? JSON.parse(rawPlayer) : null;
      storedPlayerId = typeof parsed?.id === "string" ? parsed.id : null;
    } catch {}
    if (storedPlayerId !== playerId) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }

    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

async function syncFromServer(playerId: string, signal?: AbortSignal): Promise<CollectionMap> {
  if (playerId.startsWith("guest_")) return {};
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      credentials: "include",
      headers: authHeaders(),
      signal,
    });
    if (!r.ok) return {};
    const data = await r.json();
    return data.collectedWords && typeof data.collectedWords === "object"
      ? (data.collectedWords as CollectionMap)
      : {};
  } catch { return {}; }
}

async function saveToServer(playerId: string, collected: CollectionMap) {
  if (playerId.startsWith("guest_")) return;
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ collectedWords: collected }),
    });
  } catch {}
}

function mergeMaps(a: CollectionMap, b: CollectionMap): CollectionMap {
  const out: CollectionMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k]) out[k] = v;
  }
  return out;
}
export function useCollection(playerId?: string) {
  const [collection, setCollection] = useState<CollectionMap>(() => {
    migrateLegacy(playerId);
    return loadLocal(playerId);
  });
  const [lastDiscovered, setLastDiscovered] = useState<CollectedWord | null>(null);
  const syncedRef = useRef<string | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    migrateLegacy(playerId);
    setCollection(loadLocal(playerId));
    setLastDiscovered(null);
    syncedRef.current = null;
    syncAbortRef.current?.abort();
  }, [playerId]);

  useEffect(() => {
    if (!playerId || syncedRef.current === playerId) return;
    syncedRef.current = playerId;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncFromServer(playerId, controller.signal).then(serverMap => {
      if (controller.signal.aborted || !Object.keys(serverMap).length) return;
      setCollection(prev => {
        const merged = mergeMaps(prev, serverMap);
        if (Object.keys(merged).length !== Object.keys(prev).length) {
          saveLocal(playerId, merged);
          return merged;
        }
        return prev;
      });
    });
  }, [playerId]);

  useEffect(() => () => syncAbortRef.current?.abort(), [playerId]);

  const recordRound = useCallback((words: Array<{ word: string; category: string }>) => {
    if (!words.length) return;
    const current = loadLocal(playerId);
    const { next, added } = mergeDiscoveries(current, words);
    if (!added.length) return;
    saveLocal(playerId, next);
    setCollection(next);

    const ranked = [...added].sort((a, b) => {
      const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
      return order[a.r] - order[b.r];
    });
    const headline = ranked[0];
    if (headline.r !== "common") setLastDiscovered(headline);

    if (playerId) saveToServer(playerId, next);
  }, [playerId]);

  const clearLastDiscovered = useCallback(() => setLastDiscovered(null), []);

  return { collection, lastDiscovered, recordRound, clearLastDiscovered };
}
