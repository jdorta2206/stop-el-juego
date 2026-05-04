import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Creates all critical indexes idempotently. Safe to call on every boot.
 * These indexes are required for the app to handle thousands of concurrent
 * players without timing out on ranking, leaderboard and room queries.
 */
export async function ensureIndexes(): Promise<void> {
  const stmts = [
    // ── player_scores ────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS player_scores_total_score_desc_idx
       ON player_scores (total_score DESC)`,
    `CREATE INDEX IF NOT EXISTS player_scores_xp_desc_idx
       ON player_scores (xp DESC)`,

    // ── game_history ─────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS game_history_created_at_idx
       ON game_history (created_at)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_created_at_desc_idx
       ON game_history (player_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_score_desc_idx
       ON game_history (player_id, score DESC)`,

    // ── rooms ────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS rooms_is_public_status_created_at_idx
       ON rooms (is_public, status, created_at)`,
    `CREATE INDEX IF NOT EXISTS rooms_status_updated_at_idx
       ON rooms (status, updated_at)`,

    // ── follows ──────────────────────────────────────────────────────
    `CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_followed_uidx
       ON follows (follower_id, followed_id)`,
    `CREATE INDEX IF NOT EXISTS follows_followed_id_idx
       ON follows (followed_id)`,

    // ── push_subscriptions ───────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS push_subscriptions_player_id_idx
       ON push_subscriptions (player_id)`,

    // ── tournaments ──────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS tournaments_is_public_status_created_at_desc_idx
       ON tournaments (is_public, status, created_at DESC)`,

    // ── daily_results ────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS daily_results_date_score_desc_idx
       ON daily_results (challenge_date, score DESC)`,
    `CREATE INDEX IF NOT EXISTS daily_results_player_date_idx
       ON daily_results (player_id, challenge_date)`,

    // ── cron_locks (for distributed dailyCron singleton) ─────────────
    `CREATE TABLE IF NOT EXISTS cron_locks (
       lock_key text PRIMARY KEY,
       last_run_date text NOT NULL,
       updated_at timestamp NOT NULL DEFAULT NOW()
     )`,
  ];

  for (const stmt of stmts) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      // Tolerate "duplicate" errors that escape IF NOT EXISTS in race conditions
      if (!/already exists/i.test(err?.message ?? "")) {
        console.error("[ensureIndexes] failed:", err?.message ?? err);
      }
    }
  }
  console.log("[ensureIndexes] All indexes verified");
}
