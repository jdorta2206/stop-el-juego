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

export function isPlayerRevoked(playerId: string): boolean {
  return revokedPlayerIds.has(playerId);
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
  revokedPlayerIds.add(playerId);
}
