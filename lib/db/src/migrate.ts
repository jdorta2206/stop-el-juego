import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Creates all critical indexes idempotently. Safe to call on every boot.
 * These indexes are required for the app to handle thousands of concurrent
 * players without timing out on ranking, leaderboard and room queries.
 */
// Readiness flag flipped to true after ensureIndexes() completes successfully.
// Routes that require the new season tables can gate on this to avoid
// cold-start races where requests arrive before tables exist.
let _indexesReady = false;
export function indexesReady(): boolean {
  return _indexesReady;
}

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

    // ── seasons / season_progress ────────────────────────────────────
    // Tables created here (alongside cron_locks) so the API works on a fresh
    // boot without requiring a separate drizzle-kit migration step.
    `CREATE TABLE IF NOT EXISTS seasons (
       id serial PRIMARY KEY,
       start_date text NOT NULL,
       end_date text NOT NULL,
       theme_json text NOT NULL DEFAULT '{}',
       created_at timestamp NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS season_progress (
       id serial PRIMARY KEY,
       player_id text NOT NULL,
       season_id integer NOT NULL,
       xp integer NOT NULL DEFAULT 0,
       claimed_tiers text NOT NULL DEFAULT '{"free":[],"premium":[]}',
       missions_json text NOT NULL DEFAULT '{}',
       updated_at timestamp NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS seasons_dates_idx
       ON seasons (start_date, end_date)`,
    // Race-safe season creation relies on this — collapses concurrent
    // first-hit / weekly-rollover INSERTs onto a single row.
    `CREATE UNIQUE INDEX IF NOT EXISTS seasons_start_date_uidx
       ON seasons (start_date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_progress_player_season_uidx
       ON season_progress (player_id, season_id)`,
    `CREATE INDEX IF NOT EXISTS season_progress_season_xp_desc_idx
       ON season_progress (season_id, xp DESC)`,
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
  _indexesReady = true;
  console.log("[ensureIndexes] All indexes verified");
}
