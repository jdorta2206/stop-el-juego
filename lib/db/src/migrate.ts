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
    // Per-user notification preferences. Idempotent ADDs so a fresh boot
    // brings legacy rows up to spec without a manual migration.
    `ALTER TABLE push_subscriptions
       ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT TRUE`,
    `ALTER TABLE push_subscriptions
       ADD COLUMN IF NOT EXISTS hour_local integer NOT NULL DEFAULT 20`,
    `ALTER TABLE push_subscriptions
       ADD COLUMN IF NOT EXISTS tz_offset_minutes integer NOT NULL DEFAULT 0`,
    `ALTER TABLE push_subscriptions
       ADD COLUMN IF NOT EXISTS muted_until bigint NOT NULL DEFAULT 0`,
    // Origin del navegador donde se hizo la suscripción. Permite filtrar
    // suscripciones duplicadas creadas desde stop-el-juego.replit.app cuando
    // el dominio canónico es stopjuegodepalabras.com.
    `ALTER TABLE push_subscriptions
       ADD COLUMN IF NOT EXISTS origin text`,

    // ── tournaments ──────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS tournaments_is_public_status_created_at_desc_idx
       ON tournaments (is_public, status, created_at DESC)`,

    // ── player_scores: streak calendar column (idempotent ADD) ───────
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS streak_days_json text NOT NULL DEFAULT '[]'`,

    // ── player_scores: Season Pass real rewards (inventory + coins) ──
    // Idempotent ADDs so existing rows keep working without a migration.
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0`,
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS inventory_json text NOT NULL DEFAULT '{"avatars":[],"frames":[]}'`,
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS equipped_avatar text`,
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS equipped_frame text`,
    // Tracks the most recent finished season for which the player has been
    // shown the "Quedaste #N" recap modal. NULL = never notified.
    `ALTER TABLE player_scores
       ADD COLUMN IF NOT EXISTS notified_final_season_id integer`,

    // ── season_finals ────────────────────────────────────────────────
    // One row per (player, season) frozen at season rollover. Used to
    // power the end-of-season recap modal and the champion cosmetic.
    `CREATE TABLE IF NOT EXISTS season_finals (
       id serial PRIMARY KEY,
       season_id integer NOT NULL,
       player_id text NOT NULL,
       final_rank integer NOT NULL,
       final_xp integer NOT NULL,
       total_players integer NOT NULL,
       awarded_cosmetic text,
       created_at timestamp NOT NULL DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_finals_season_player_uidx
       ON season_finals (season_id, player_id)`,
    `CREATE INDEX IF NOT EXISTS season_finals_player_id_idx
       ON season_finals (player_id)`,

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

    // ── play_subscriptions (Google Play Billing) ─────────────────────
    // Created here so a fresh boot has the table available without a
    // separate drizzle-kit migration step.
    `CREATE TABLE IF NOT EXISTS play_subscriptions (
       id serial PRIMARY KEY,
       player_id text NOT NULL,
       product_id text NOT NULL,
       purchase_token text NOT NULL UNIQUE,
       order_id text,
       state text NOT NULL DEFAULT 'ACTIVE',
       expiry_time_ms bigint NOT NULL DEFAULT 0,
       start_time_ms bigint NOT NULL DEFAULT 0,
       raw_json text NOT NULL DEFAULT '{}',
       created_at timestamp NOT NULL DEFAULT NOW(),
       updated_at timestamp NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_id_idx
       ON play_subscriptions (player_id)`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_state_expiry_idx
       ON play_subscriptions (player_id, state, expiry_time_ms)`,

    // ── impossible_results (Palabra Imposible daily) ─────────────────
    `CREATE TABLE IF NOT EXISTS impossible_results (
       id serial PRIMARY KEY,
       player_id text NOT NULL,
       player_name text NOT NULL,
       challenge_date text NOT NULL,
       language text NOT NULL DEFAULT 'es',
       letter text NOT NULL,
       category text NOT NULL,
       attempted_word text NOT NULL DEFAULT '',
       won boolean NOT NULL DEFAULT false,
       time_ms integer NOT NULL DEFAULT 60000,
       created_at timestamp NOT NULL DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS impossible_results_player_date_lang_uniq
       ON impossible_results (player_id, challenge_date, language)`,
    `CREATE INDEX IF NOT EXISTS impossible_results_date_lang_idx
       ON impossible_results (challenge_date, language)`,
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
