import { sql } from "drizzle-orm";
import { db, pool } from "./index";

/**
 * Creates all critical indexes idempotently. Safe to call on every boot.
 * These indexes are required for the app to handle thousands of concurrent
 * players without timing out on ranking, leaderboard and room queries.
 */
let _indexesReady = false;
export function indexesReady(): boolean {
  return _indexesReady;
}

export async function ensureIndexes(): Promise<void> {
  const client = await pool.connect();
  const lockKey = "stop:ensure-indexes:v1";
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [lockKey]);
    const stmts = [
    // Bootstrap the core tables before creating indexes/columns on them. Production
    // does not run drizzle-kit push; ensureIndexes() is the runtime DB bootstrap.
    // CREATE TABLE IF NOT EXISTS is non-destructive for existing Railway databases.
    `CREATE TABLE IF NOT EXISTS player_scores (id serial PRIMARY KEY, player_id text NOT NULL UNIQUE, player_name text NOT NULL, avatar_color text NOT NULL DEFAULT '#e53e3e', profile_picture text, total_score integer NOT NULL DEFAULT 0, games_played integer NOT NULL DEFAULT 0, wins integer NOT NULL DEFAULT 0, stripe_customer_id text, stripe_subscription_id text, is_premium boolean NOT NULL DEFAULT FALSE, current_streak integer NOT NULL DEFAULT 0, longest_streak integer NOT NULL DEFAULT 0, last_played_date text, streak_days_json text NOT NULL DEFAULT '[]', xp integer NOT NULL DEFAULT 0, level integer NOT NULL DEFAULT 1, achievements_json text NOT NULL DEFAULT '[]', achievement_stats_json text NOT NULL DEFAULT '{}', personal_bests_json text NOT NULL DEFAULT '{}', coins integer NOT NULL DEFAULT 0, inventory_json text NOT NULL DEFAULT '{"avatars":[],"frames":[]}', equipped_avatar text, equipped_frame text, equipped_background text, equipped_title text, prestige_claims_json text NOT NULL DEFAULT '[]', collection_claims_json text NOT NULL DEFAULT '[]', notified_final_season_id integer, collected_words_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS game_history (id serial PRIMARY KEY, player_id text NOT NULL, score integer NOT NULL DEFAULT 0, letter text NOT NULL, mode text NOT NULL DEFAULT 'solo', won boolean NOT NULL DEFAULT FALSE, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS word_validation_cache (id serial PRIMARY KEY, word text NOT NULL, category text NOT NULL, lang text NOT NULL, is_valid boolean NOT NULL, source text NOT NULL DEFAULT 'ai', model text, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS word_validation_cache_lookup ON word_validation_cache (word, category, lang)`,
    `CREATE INDEX IF NOT EXISTS word_validation_cache_created_at_idx ON word_validation_cache (created_at)`,
    `CREATE TABLE IF NOT EXISTS custom_category_packs (id serial PRIMARY KEY, player_id text NOT NULL, name text NOT NULL, icon text NOT NULL DEFAULT '✨', color text NOT NULL DEFAULT '#f9a825', categories_json text NOT NULL, language text NOT NULL DEFAULT 'es', created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS custom_packs_player_idx ON custom_category_packs (player_id)`,
    `CREATE TABLE IF NOT EXISTS rooms (id serial PRIMARY KEY, room_code text NOT NULL UNIQUE, host_id text NOT NULL, status text NOT NULL DEFAULT 'waiting', current_letter text, current_round integer NOT NULL DEFAULT 0, max_rounds integer NOT NULL DEFAULT 3, max_players integer NOT NULL DEFAULT 8, game_mode text NOT NULL DEFAULT 'classic', language text NOT NULL DEFAULT 'es', players_json text NOT NULL DEFAULT '[]', stopper_json text, is_public boolean NOT NULL DEFAULT FALSE, host_name text NOT NULL DEFAULT '', tournament_id integer, tournament_match_id text, created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW(), room_version bigint NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS follows (id serial PRIMARY KEY, follower_id text NOT NULL, followed_id text NOT NULL, followed_name text NOT NULL, followed_picture text, followed_avatar_color text NOT NULL DEFAULT '#e53e3e', created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (id serial PRIMARY KEY, player_id text NOT NULL, endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, language text NOT NULL DEFAULT 'es', enabled boolean NOT NULL DEFAULT TRUE, hour_local integer NOT NULL DEFAULT 20, tz_offset_minutes integer NOT NULL DEFAULT 0, time_zone text, muted_until bigint NOT NULL DEFAULT 0, origin text, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS daily_results (id serial PRIMARY KEY, player_id text NOT NULL, player_name text NOT NULL, avatar_color text NOT NULL DEFAULT '#e53e3e', challenge_date text NOT NULL, score integer NOT NULL DEFAULT 0, letter text NOT NULL, language text NOT NULL DEFAULT 'es', created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS tournaments (id serial PRIMARY KEY, code text NOT NULL UNIQUE, host_id text NOT NULL, host_name text NOT NULL DEFAULT '', name text NOT NULL, status text NOT NULL DEFAULT 'waiting', size integer NOT NULL DEFAULT 4, is_public boolean NOT NULL DEFAULT FALSE, players_json text NOT NULL DEFAULT '[]', bracket_json text, created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS player_scores_total_score_desc_idx ON player_scores (total_score DESC)`,
    `CREATE INDEX IF NOT EXISTS player_scores_xp_desc_idx ON player_scores (xp DESC)`,
    `CREATE INDEX IF NOT EXISTS game_history_created_at_idx ON game_history (created_at)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_created_at_desc_idx ON game_history (player_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS game_history_player_id_score_desc_idx ON game_history (player_id, score DESC)`,
    `CREATE INDEX IF NOT EXISTS rooms_is_public_status_created_at_idx ON rooms (is_public, status, created_at)`,
    `CREATE INDEX IF NOT EXISTS rooms_status_updated_at_idx ON rooms (status, updated_at)`,
    `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_version bigint NOT NULL DEFAULT 0`,
    `CREATE OR REPLACE FUNCTION stop_rooms_bump_version() RETURNS trigger AS $stop_rooms$ BEGIN IF NEW.updated_at <= OLD.updated_at THEN NEW.updated_at := OLD.updated_at + interval '1 millisecond'; END IF; NEW.room_version := OLD.room_version + 1; RETURN NEW; END; $stop_rooms$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS rooms_bump_version_trigger ON rooms`,
    `CREATE TRIGGER rooms_bump_version_trigger BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION stop_rooms_bump_version()`,
    `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tournament_id integer`,
    `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tournament_match_id text`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rooms_tournament_match_uidx ON rooms (tournament_id, tournament_match_id) WHERE tournament_id IS NOT NULL AND tournament_match_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS follows_follower_followed_uidx ON follows (follower_id, followed_id)`,
    `CREATE INDEX IF NOT EXISTS follows_followed_id_idx ON follows (followed_id)`,
    `CREATE INDEX IF NOT EXISTS push_subscriptions_player_id_idx ON push_subscriptions (player_id)`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT TRUE`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS hour_local integer NOT NULL DEFAULT 20`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tz_offset_minutes integer NOT NULL DEFAULT 0`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS time_zone text`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS muted_until bigint NOT NULL DEFAULT 0`,
    `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS origin text`,
    `CREATE INDEX IF NOT EXISTS tournaments_is_public_status_created_at_desc_idx ON tournaments (is_public, status, created_at DESC)`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS streak_days_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS inventory_json text NOT NULL DEFAULT '{"avatars":[],"frames":[]}'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS profile_picture text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_avatar text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_frame text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_background text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS equipped_title text`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS prestige_claims_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS collection_claims_json text NOT NULL DEFAULT '[]'`,
    `ALTER TABLE player_scores ADD COLUMN IF NOT EXISTS notified_final_season_id integer`,
    `CREATE TABLE IF NOT EXISTS season_finals (id serial PRIMARY KEY, season_id integer NOT NULL, player_id text NOT NULL, final_rank integer NOT NULL, final_xp integer NOT NULL, total_players integer NOT NULL, awarded_cosmetic text, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_finals_season_player_uidx ON season_finals (season_id, player_id)`,
    `CREATE INDEX IF NOT EXISTS season_finals_player_id_idx ON season_finals (player_id)`,
    `CREATE INDEX IF NOT EXISTS daily_results_date_score_desc_idx ON daily_results (challenge_date, score DESC)`,
    `CREATE INDEX IF NOT EXISTS daily_results_player_date_idx ON daily_results (player_id, challenge_date)`,
    `DELETE FROM daily_results a USING daily_results b
       WHERE a.player_id = b.player_id
         AND a.challenge_date = b.challenge_date
         AND (a.score < b.score OR (a.score = b.score AND a.id < b.id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS daily_results_player_date_uidx
       ON daily_results (player_id, challenge_date)`,
    `CREATE TABLE IF NOT EXISTS multiplayer_settlement_claims (room_id integer NOT NULL, player_id text NOT NULL, created_at timestamp NOT NULL DEFAULT NOW(), PRIMARY KEY (room_id, player_id))`,
    `CREATE TABLE IF NOT EXISTS cron_locks (lock_key text PRIMARY KEY, last_run_date text NOT NULL, updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS revoked_player_ids (player_id text PRIMARY KEY, revoked_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS revoked_player_ids_revoked_at_idx ON revoked_player_ids (revoked_at)`,
    `CREATE TABLE IF NOT EXISTS api_rate_limits (bucket_key text PRIMARY KEY, window_start timestamp NOT NULL, hits integer NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS ai_word_validation_claims (cache_key text PRIMARY KEY, claimed_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS ai_word_validation_daily_quota (quota_date date NOT NULL, scope text NOT NULL, used integer NOT NULL DEFAULT 0, PRIMARY KEY (quota_date, scope))`,
    `CREATE TABLE IF NOT EXISTS guest_stats (day text PRIMARY KEY, games integer NOT NULL DEFAULT 0, conversions integer NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS seasons (id serial PRIMARY KEY, start_date text NOT NULL, end_date text NOT NULL, theme_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS season_progress (id serial PRIMARY KEY, player_id text NOT NULL, season_id integer NOT NULL, xp integer NOT NULL DEFAULT 0, claimed_tiers text NOT NULL DEFAULT '{"free":[],"premium":[]}', missions_json text NOT NULL DEFAULT '{}', updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS seasons_dates_idx ON seasons (start_date, end_date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS seasons_start_date_uidx ON seasons (start_date)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS season_progress_player_season_uidx ON season_progress (player_id, season_id)`,
    `CREATE TABLE IF NOT EXISTS season_event_claims (season_id integer NOT NULL, player_id text NOT NULL, event_key text NOT NULL, created_at timestamp NOT NULL DEFAULT NOW(), PRIMARY KEY (season_id, player_id, event_key))`,
    `CREATE INDEX IF NOT EXISTS season_progress_season_xp_desc_idx ON season_progress (season_id, xp DESC)`,
    `CREATE TABLE IF NOT EXISTS play_subscriptions (id serial PRIMARY KEY, player_id text NOT NULL, product_id text NOT NULL, purchase_token text NOT NULL UNIQUE, order_id text, state text NOT NULL DEFAULT 'ACTIVE', expiry_time_ms bigint NOT NULL DEFAULT 0, start_time_ms bigint NOT NULL DEFAULT 0, raw_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS play_product_purchases (id serial PRIMARY KEY, player_id text NOT NULL, product_id text NOT NULL, purchase_token text NOT NULL UNIQUE, order_id text, purchase_state bigint NOT NULL DEFAULT 0, raw_json text NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT NOW(), updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS play_product_purchases_player_id_idx ON play_product_purchases (player_id)`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_id_idx ON play_subscriptions (player_id)`,
    `CREATE INDEX IF NOT EXISTS play_subscriptions_player_state_expiry_idx ON play_subscriptions (player_id, state, expiry_time_ms)`,
    `CREATE TABLE IF NOT EXISTS score_voucher_uses (jti text PRIMARY KEY, expires_at timestamp NOT NULL, used_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS score_submission_claims (id serial PRIMARY KEY, player_id text NOT NULL, submission_id text NOT NULL, is_bonus boolean NOT NULL DEFAULT FALSE, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS score_submission_idempotency (submission_id text PRIMARY KEY, player_id text NOT NULL, request_hash text NOT NULL, response_json text NOT NULL, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS score_submission_claims_player_submission_uidx ON score_submission_claims (player_id, submission_id, is_bonus)`,
    `CREATE TABLE IF NOT EXISTS score_bonus_claims (token_set_hash text PRIMARY KEY, player_id text NOT NULL, max_score integer NOT NULL, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS score_bonus_claims_player_id_idx ON score_bonus_claims (player_id)`,
    `CREATE INDEX IF NOT EXISTS score_bonus_claims_expires_at_idx ON score_bonus_claims (expires_at)`,
    `CREATE TABLE IF NOT EXISTS admob_reward_requests (request_id text PRIMARY KEY, rewarded boolean NOT NULL DEFAULT FALSE, player_id text NOT NULL, placement text, origin text, client_state text NOT NULL DEFAULT 'pending', transaction_id text, created_at timestamp NOT NULL DEFAULT NOW(), consumed_at timestamp)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS admob_reward_requests_transaction_uidx ON admob_reward_requests (transaction_id) WHERE transaction_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS admob_reward_requests_created_at_idx ON admob_reward_requests (created_at)`,
    `CREATE INDEX IF NOT EXISTS score_voucher_uses_expires_at_idx ON score_voucher_uses (expires_at)`,
    `CREATE TABLE IF NOT EXISTS impossible_results (id serial PRIMARY KEY, player_id text NOT NULL, player_name text NOT NULL, challenge_date text NOT NULL, language text NOT NULL DEFAULT 'es', letter text NOT NULL, category text NOT NULL, attempted_word text NOT NULL DEFAULT '', won boolean NOT NULL DEFAULT false, time_ms integer NOT NULL DEFAULT 60000, created_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS impossible_results_player_date_lang_uniq ON impossible_results (player_id, challenge_date, language)`,
    `CREATE INDEX IF NOT EXISTS impossible_results_date_lang_idx ON impossible_results (challenge_date, language)`,
    `CREATE TABLE IF NOT EXISTS halloween_progress (id serial PRIMARY KEY, player_id text NOT NULL, event_year integer NOT NULL, games_completed integer NOT NULL DEFAULT 0, scares_received integer NOT NULL DEFAULT 0, scares_provoked integer NOT NULL DEFAULT 0, coins_earned integer NOT NULL DEFAULT 0, rewards_json text NOT NULL DEFAULT '[]', event_keys_json text NOT NULL DEFAULT '[]', updated_at timestamp NOT NULL DEFAULT NOW())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS halloween_progress_player_year_uidx ON halloween_progress (player_id, event_year)`,
    `CREATE INDEX IF NOT EXISTS halloween_progress_year_games_idx ON halloween_progress (event_year, games_completed DESC)`,
    `CREATE TABLE IF NOT EXISTS halloween_event_claims (event_year integer NOT NULL, player_id text NOT NULL, event_key text NOT NULL, created_at timestamp NOT NULL DEFAULT NOW(), PRIMARY KEY (event_year, player_id, event_key))`,
    `CREATE TABLE IF NOT EXISTS multiplayer_settlement_aux_claims (room_id integer NOT NULL, player_id text NOT NULL, effect text NOT NULL, created_at timestamp NOT NULL DEFAULT NOW(), PRIMARY KEY (room_id, player_id, effect))`,
    `CREATE TABLE IF NOT EXISTS halloween_scare_cooldowns (room_id integer NOT NULL, player_id text NOT NULL, available_at timestamp with time zone NOT NULL, updated_at timestamp with time zone NOT NULL DEFAULT NOW(), PRIMARY KEY (room_id, player_id))`,
    `CREATE TABLE IF NOT EXISTS halloween_migration_state (migration_key text PRIMARY KEY, completed_at timestamp NOT NULL DEFAULT NOW())`,
  ];

  for (const stmt of stmts) {
    try {
      await client.query(stmt);
    } catch (err: any) {
      console.error("[ensureIndexes] failed:", err?.message ?? err);
      _indexesReady = false;
      throw err;
    }
  }

  try {
    await client.query("BEGIN");
    try {
      const claimed = await client.query(`
        INSERT INTO halloween_migration_state (migration_key)
        VALUES ('legacy_event_claims_v1')
        ON CONFLICT (migration_key) DO NOTHING
        RETURNING migration_key
      `);
      if ((claimed.rows?.length ?? 0) > 0) {
        const legacy = await client.query(`
          SELECT event_year, player_id, event_keys_json
          FROM halloween_progress
          WHERE event_keys_json IS NOT NULL AND event_keys_json <> '[]'
        `);
        for (const row of (legacy.rows ?? []) as Array<{ event_year: number; player_id: string; event_keys_json: string }>) {
          let keys: unknown;
          try { keys = JSON.parse(row.event_keys_json); } catch { continue; }
          if (!Array.isArray(keys)) continue;

          for (const key of keys) {
            if (typeof key !== "string" || !key) continue;
            await client.query(
              `INSERT INTO halloween_event_claims (event_year, player_id, event_key)
               VALUES ($1, $2, $3)
               ON CONFLICT (event_year, player_id, event_key) DO NOTHING`,
              [row.event_year, row.player_id, key],
            );
          }
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err: any) {
    console.error("[ensureIndexes] Halloween claim backfill failed:", err?.message ?? err);
    _indexesReady = false;
    throw err;
  }

  _indexesReady = true;
  console.log("[ensureIndexes] All indexes verified");
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockKey]);
    } finally {
      client.release();
    }
  }
}
