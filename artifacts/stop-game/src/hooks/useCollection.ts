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

// The legacy collection key was not scoped to an account. Never migrate it
// into an authenticated player's namespace: on a shared device it may belong
// to a different account (or to a previous guest), which would contaminate the
// new account and could later be synced back to the server. Server data is the
// authoritative recovery path for authenticated players. Keep the legacy key
// untouched so an explicit, future migration can be handled safely.

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
    return loadLocal(playerId);
  });
  const [lastDiscovered, setLastDiscovered] = useState<CollectedWord | null>(null);
  const syncedRef = useRef<string | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  // When the player changes (login / account switch), reload from the
  // correct scoped cache so we never carry another player's words over.
  useEffect(() => {
    setCollection(loadLocal(playerId));
    syncedRef.current = null;
    syncAbortRef.current?.abort();
  }, [playerId]);

  // Server → local merge on mount (per-player; re-runs on account switch).
  useEffect(() => {
    if (!playerId || syncedRef.current === playerId) return;
    syncedRef.current = playerId;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncFromServer(playerId, controller.signal).then(serverMap => {
      if (controller.signal.aborted || !Object.keys(serverMap).length) return;
      setCollection(prev => {
        if (controller.signal.aborted || syncAbortRef.current !== controller) return prev;
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
