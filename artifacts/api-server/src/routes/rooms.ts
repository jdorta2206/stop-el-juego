// connection to this room. Used by the stuck-sweep in /results so a player
// who closed the tab is auto-skipped immediately instead of stalling the
// round for the whole grace window.
function isPlayerOnline(code: string, playerId: string): boolean {
  const set = sseClients.get(code);
  if (!set || set.size === 0) return false;
  for (const c of set) if (c.playerId === playerId) return true;
  return false;
}

// ⏱️ Round-advance grace windows (module-level so the in-handler sweep AND the
// background sweepStuckRooms() failsafe share identical timings).
// SUBMIT_GRACE_MS: after STOP, how long we wait before zeroing non-submitters.
// PRESENCE_GRACE_MS: buffer before treating an SSE drop as "offline".
const SUBMIT_GRACE_MS = 15_000;
const PRESENCE_GRACE_MS = 4_000;

function broadcastRoom(code: string, roomPayload: object) {
  const clients = sseClients.get(code);
  if (!clients || clients.size === 0) return;
  const room = roomPayload as any;
  const memberIds = new Set(
    Array.isArray(room.players)
      ? room.players.map((p: any) => p?.playerId).filter(Boolean)
      : [],
  );

  for (const client of [...clients]) {
    try {
      // A private-room member who has since left must lose the stream immediately;
      // otherwise an already-open SSE would bypass the membership check performed
      // only during connection setup.
      if (room.isPublic === false && !memberIds.has(client.playerId)) {
        client.res.end();
        clients.delete(client);
        continue;
      }

      // Public rooms are discoverable, but non-members must receive the same
      // sanitized view as /spectate rather than the full in-round answers.
      const payload = room.isPublic === true && !memberIds.has(client.playerId)
        ? sanitizeRoomForSpectator(room)
        : room;
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
  if (clients.size === 0) sseClients.delete(code);
}
