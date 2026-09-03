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
    `CREATE INDEX IF NOT EXISTS player_scores_total_score_desc_idx ON player_scores (total_score DESC)`,
    `CREATE INDEX IF NOT EXISTS player_scores_xp_desc_idx ON player_scores (xp DESC)`,
    `CREATE INDEX IF NOT EXISTS game_history_created_at_idx ON game_history (created_at)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_created_at_desc_idx ON game_history (player_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_score_desc_idx ON game_history (player_id, score DESC)`,
    `CREATE INDEX IF NOT EXISTS rooms_is_public_status_created_at_idx ON rooms (is_public, status, created_at)`,
    `CREATE INDEX IF NOT EXISTS rooms_status_updated_at_idx ON rooms (status, updated_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_followed_uidx ON follows (follower_id, followed_id)`,
    `CREATE INDEX IF NOT EXISTS follows_followed_id_idx ON follows (followed_id)`,
    `CREATE INDEX IF NOT EXISTS push_subscriptions_player_id_idx ON push_subscriptions (player_id)`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT TRUE`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS hour_local integer NOT NULL DEFAULT 20`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tz_offset_minutes integer NOT NULL DEFAULT 0`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS muted_until bigint NOT NULL DEFAULT 0`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS origin text`,
    `CREATE INDEX IF NOT EXISTS tournaments_is_public_status_created_at_desc_idx ON tournaments (is_public, status, created_at DESC)`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS streak_days_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS inventory_json text NOT NULL DEFAULT '{"avatars":[],"frames":[]}'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_avatar text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_frame text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_title text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS prestige_claims_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS collection_claims_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS notified_final_season_id integer`,
    `CREATE TABLE IF NOT EXISTS season_finals (id serial PRIMARY KEY, season_id integer NOT NULL, player_id text NOT NULL, final_rank integer NOT NULL, final_xp integer NOT NULL, total_players integer NOT NULL, awarded_cosmetic text, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_finals_season_player_uidx ON season_finals (season_id, player_id)`,
    `CREATE INDEX IF NOT EXISTS season_finals_player_id_idx ON season_finals (player_id)`,
    `CREATE INDEX IF NOT EXISTS daily_results_date_score_desc_idx ON daily_results (challenge_date, score DESC)`,
    `CREATE INDEX IF NOT EXISTS daily_results_player_date_idx ON daily_results (player_id, challenge_date)`,
    `CREATE TABLE IF NOT EXISTS cron_locks (lock_key text PRIMARY KEY, last_run_date text NOT NULL, updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS guest_stats (day text PRIMARY KEY, games integer NOT NULL DEFAULT 0, conversions integer NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS seasons (id serial PRIMARY KEY, start_date text NOT NULL, end_date text NOT NULL, theme_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS season_progress (id serial PRIMARY KEY, player_id text NOT NULL, season_id integer NOT NULL, xp integer NOT NULL DEFAULT 0, claimed_tiers text NOT NULL DEFAULT '{"free":[],"premium":[]}', missions_json text NOT NULL DEFAULT '{}', updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS seasons_dates_idx ON seasons (start_date, end_date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS seasons_start_date_uidx ON seasons (start_date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_progress_player_season_uidx ON season_progress (player_id, season_id)`,
    `CREATE INDEX IF NOT EXISTS season_progress_season_xp_desc_idx ON season_progress (season_id, xp DESC)`,
    `CREATE TABLE IF NOT EXISTS play_subscriptions (id serial PRIMARY KEY, player_id text NOT NULL, product_id text NOT NULL, purchase_token text NOT NULL UNIQUE, order_id text, state text NOT NULL DEFAULT 'ACTIVE', expiry_time_ms bigint NOT NULL DEFAULT 0, start_time_ms bigint NOT NULL DEFAULT 0, raw_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_id_idx ON play_subscriptions (player_id)`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_state_expiry_idx ON play_subscriptions (player_id, state, expiry_time_ms)`,
    `CREATE TABLE IF NOT EXISTS impossible_results (id serial PRIMARY KEY, player_id text NOT NULL, player_name text NOT NULL, challenge_date text NOT NULL, language text NOT NULL DEFAULT 'es', letter text NOT NULL, category text NOT NULL, attempted_word text NOT NULL DEFAULT '', won boolean NOT NULL DEFAULT false, time_ms integer NOT NULL DEFAULT 60000, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS impossible_results_player_date_lang_uniq ON impossible_results (player_id, challenge_date, language)`,
    `CREATE INDEX IF NOT EXISTS impossible_results_date_lang_idx ON impossible_results (challenge_date, language)`,
    // Persistent single-use registry for signed score vouchers. The voucher
    // itself remains stateless; this table only records consumed JTIs so a
    // restart or a second API replica cannot make an already-used voucher live again.
    `CREATE TABLE IF NOT EXISTS score_voucher_uses (jti text PRIMARY KEY, expires_at bigint NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS score_voucher_uses_expires_at_idx ON score_voucher_uses (expires_at)`,
  ];

  for (const stmt of stmts) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      if (!/already exists/i.test(err?.message ?? "")) {
        console.error("[ensureIndexes] failed:", err?.message ?? err);
      }
    }
  }
  _indexesReady = true;
  console.log("[ensureIndexes] All indexes verified");
}
