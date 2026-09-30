import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const revokedPlayerIds = new Set<string>();
let revocationCacheReady = false;

export async function loadRevokedPlayerIds(): Promise<void> {
  const rows = await db.execute(sql`SELECT player_id FROM revoked_player_ids`);
  revokedPlayerIds.clear();
  for (const row of rows.rows as Array<{ player_id: string }>) {
    if (row.player_id) revokedPlayerIds.add(row.player_id);
  }
  revocationCacheReady = true;
}

export async function isPlayerRevoked(playerId: string): Promise<boolean> {
  if (!playerId) return false;
  try {
    const rows = await db.execute(sql`
      SELECT 1 FROM revoked_player_ids WHERE player_id = ${playerId} LIMIT 1
    `);
    const revoked = (rows.rows as any[]).length > 0;
    if (revoked) revokedPlayerIds.add(playerId);
    else revokedPlayerIds.delete(playerId);
    return revoked;
  } catch (error) {
    // Fail closed for authenticated identity checks: a DB error must never
    // turn an unknown revocation state into an accepted account.
    console.error("[playerRevocation] DB check failed:", error);
    return true;
  }
}

export function isPlayerRevocationCacheReady(): boolean {
  return revocationCacheReady;
}

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
