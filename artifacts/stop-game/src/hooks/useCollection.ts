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
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}
