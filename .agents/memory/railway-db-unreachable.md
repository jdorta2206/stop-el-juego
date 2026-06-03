---
name: Railway can't reach Replit internal DB
description: Why www (Railway) gives 500 on DB routes while replit.app works; the shared-DB constraint and schema gotcha
---

# www (Railway) 500s on ranking/rooms = can't reach Replit's internal DB

The canonical/workspace DATABASE_URL points at host `helium` with `sslmode=disable`
— Replit's **internal** Postgres, only reachable from inside Replit's network.
`stop-el-juego.replit.app` (a Replit deployment) reaches it fine (200). **Railway runs
outside Replit and physically cannot connect to `helium`**, so every DB query on
`www.stopjuegodepalabras.com` returns 500 ("Failed query"). Login (Google/Facebook)
works on www because the OAuth/session path doesn't hit that DB.

**Schema gotcha:** `lib/db/src/migrate.ts` `ensureIndexes()` (run at boot) only
CREATE TABLEs a *subset* (season_finals, cron_locks, guest_stats, seasons,
season_progress, play_subscriptions, impossible_results). The **core** tables
(player_scores, game_history, rooms, follows, push_subscriptions, tournaments,
daily_results, custom_category_packs, word_validation_cache) are created by drizzle
push in dev — they are NOT auto-created in prod. So a fresh empty external DB will
still 500 until the full schema is loaded.

**Fix direction (needs user decision):** all hosts (Railway www, replit.app, Android
TWA) must share ONE externally-reachable Postgres (Railway Postgres or Neon). Point
both api-servers at it, load full schema, migrate existing rows (had 21 player_scores).
**Why:** keeps rankings/users unified across web + app. **Do NOT** paste DATABASE_URL
values from other AIs' scripts; set it deliberately via the host's dashboard.
