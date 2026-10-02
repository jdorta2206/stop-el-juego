import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const revokedPlayerIds = new Set<string>();
let revocationCacheReady = false;

export async function loadRevokedPlayerIds(): Promise<void> {
  const rows = await db.execute(sql`SELECT player_id FROM revoked_player_ids`);
  const next = new Set<string>();
  for (const row of rows.rows as Array<{ player_id: string }>) {
    if (row.player_id) next.add(row.player_id);
  }
  // Swap only after the complete DB snapshot is available. This prevents a
  // refresh from briefly exposing an empty revocation cache.
  revokedPlayerIds.clear();
  for (const playerId of next) revokedPlayerIds.add(playerId);
  revocationCacheReady = true;
}

export function isPlayerRevoked(playerId: string): boolean {
  return revokedPlayerIds.has(playerId);
}

export function isPlayerRevocationCacheReady(): boolean {
  return revocationCacheReady;
}

// Keep revocation state coherent across Railway instances. The database is the
// source of truth; this bounded refresh closes the window where an account
// deleted on one instance could still be accepted by another instance that
// had an older in-memory cache.
const REVOCATION_REFRESH_MS = 5_000;
const revocationRefresh = setInterval(() => {
  void loadRevokedPlayerIds().catch((err) => {
    console.error("[playerRevocation] periodic refresh failed:", err);
  });
}, REVOCATION_REFRESH_MS);
revocationRefresh.unref?.();

export async function revokePlayerId(playerId: string, tx?: any): Promise<void> {
  if (!playerId) return;
  const executor = tx ?? db;
  await executor.execute(sql`
    INSERT INTO revoked_player_ids (player_id, revoked_at)
    VALUES (${playerId}, NOW())
    ON CONFLICT (player_id) DO NOTHING
  `);
}

export function markPlayerRevoked(playerId: string): void {
  if (playerId) revokedPlayerIds.add(playerId);
}

export async function restorePlayerId(playerId: string): Promise<void> {
  if (!playerId) return;
  await db.execute(sql`DELETE FROM revoked_player_ids WHERE player_id = ${playerId}`);
  revokedPlayerIds.delete(playerId);
}
