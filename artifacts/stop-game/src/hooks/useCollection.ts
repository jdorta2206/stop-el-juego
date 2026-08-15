import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import {
  type CollectionMap,
  type CollectedWord,
  mergeDiscoveries,
  normalizeWord,
} from "@/lib/collection";

const LEGACY_KEY = "stop_collection_v1";
const MAX_COLLECTION_ENTRIES = 5000;
const VALID_RARITIES = new Set(["common", "rare", "epic", "legendary"]);

function localKey(playerId?: string) {
  return playerId ? `stop_collection_v1:${playerId}` : "stop_collection_v1:guest";
}

function isCollectedWord(value: unknown): value is CollectedWord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.name === "string" &&
    entry.name.trim().length > 0 &&
    entry.name.length <= 100 &&
    typeof entry.cat === "string" &&
    entry.cat.length <= 100 &&
    typeof entry.r === "string" &&
    VALID_RARITIES.has(entry.r) &&
    typeof entry.d === "number" &&
    Number.isFinite(entry.d) &&
    entry.d >= 0;
}

function sanitizeCollection(value: unknown): CollectionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: CollectionMap = {};
  for (const [key, entry] of Object.entries(value).slice(0, MAX_COLLECTION_ENTRIES)) {
    if (!isCollectedWord(entry)) continue;
    const normalizedKey = normalizeWord(entry.name);
    if (!normalizedKey || normalizedKey !== key || result[normalizedKey]) continue;
    result[normalizedKey] = entry;
  }
  return result;
}

function loadLocal(playerId?: string): CollectionMap {
  try {
    const raw = localStorage.getItem(localKey(playerId));
    if (!raw) return {};
    return sanitizeCollection(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load collection from local storage", error);
    return {};
  }
}

function saveLocal(playerId: string | undefined, c: CollectionMap) {
  try {
    localStorage.setItem(localKey(playerId), JSON.stringify(c));
  } catch (error) {
    console.warn("Could not save collection to local storage", error);
  }
}

function migrateLegacy(playerId?: string) {
  if (!playerId) return;
  try {
    const scopedKey = localKey(playerId);
    if (localStorage.getItem(scopedKey)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const sanitized = sanitizeCollection(JSON.parse(legacy));
    if (Object.keys(sanitized).length) {
      localStorage.setItem(scopedKey, JSON.stringify(sanitized));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch (error) {
    console.warn("Could not migrate legacy collection", error);
  }
}

async function syncFromServer(playerId: string): Promise<CollectionMap> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${encodeURIComponent(playerId)}`);
    if (!r.ok) return {};
    const data: unknown = await r.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const collectedWords = (data as Record<string, unknown>).collectedWords;
    return sanitizeCollection(collectedWords);
  } catch (error) {
    console.warn("Could not sync collection from server", error);
    return {};
  }
}

async function saveToServer(playerId: string, collected: CollectionMap) {
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${encodeURIComponent(playerId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ collectedWords: collected }),
    });
  } catch (error) {
    console.warn("Could not save collection to server", error);
  }
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

  useEffect(() => {
    migrateLegacy(playerId);
    setCollection(loadLocal(playerId));
    syncedRef.current = null;
  }, [playerId]);

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
