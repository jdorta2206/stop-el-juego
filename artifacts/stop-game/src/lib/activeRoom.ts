const KEY = "stop:activeRoom";
const TTL_MS = 30 * 60 * 1000;

export type ActiveRoom = { code: string; playerId: string; ts: number };

export function saveActiveRoom(code: string, playerId: string) {
  try {
    const payload: ActiveRoom = { code, playerId, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export function touchActiveRoom() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ActiveRoom;
    if (!parsed?.code || !parsed?.playerId) return;
    localStorage.setItem(KEY, JSON.stringify({ ...parsed, ts: Date.now() }));
  } catch {}
}

export function loadActiveRoom(): ActiveRoom | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveRoom;
    if (!parsed?.code || !parsed?.playerId) return null;
    if (Date.now() - (parsed.ts ?? 0) > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveRoom() {
  try { localStorage.removeItem(KEY); } catch {}
}
