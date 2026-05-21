import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/utils";
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
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

async function syncFromServer(playerId: string): Promise<CollectionMap> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`);
    if (!r.ok) return {};
    const data = await r.json();
    return data.collectedWords && typeof data.collectedWords === "object"
      ? (data.collectedWords as CollectionMap)
      : {};
  } catch { return {}; }
}

async function saveToServer(playerId: string, collected: CollectionMap) {
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // When the player changes (login / account switch), reload from the
  // correct scoped cache so we never carry another player's words over.
  useEffect(() => {
    migrateLegacy(playerId);
    setCollection(loadLocal(playerId));
    syncedRef.current = null;
  }, [playerId]);

  // Server → local merge on mount (per-player; re-runs on account switch).
  useEffect(() => {
    if (!playerId || syncedRef.current === playerId) return;
    syncedRef.current = playerId;
    syncFromServer(playerId).then(serverMap => {
      if (!Object.keys(serverMap).length) return;
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

  /** Call after a round with the valid words. Persists locally + on the
   * server. If at least one NEW word was rare/epic/legendary, surfaces it
   * via lastDiscovered for the toast. */
  const recordRound = useCallback((words: Array<{ word: string; category: string }>) => {
    if (!words.length) return;
    const current = loadLocal(playerId);
    const { next, added } = mergeDiscoveries(current, words);
    if (!added.length) return;
    saveLocal(playerId, next);
    setCollection(next);

    // Surface the rarest new discovery for the toast (common ones don't
    // interrupt — the page badge increment is enough).
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
