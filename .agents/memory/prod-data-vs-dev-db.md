---
name: Production data is NOT in the workspace/dev DB
description: Where the real STOP player data lives and how to extract/migrate it
---

The workspace/dev Postgres (`helium`, `DATABASE_URL` in Replit dev) holds **fake seed
data** — placeholder players like MasterSTOP/WordKing/SpeedQuill. The **real** players
(MGK ~12.6k, "J D" premium, Silvia Modeq, Jose Zaragoza…) live ONLY in the **Replit
deployment's production database** that serves `stop-el-juego.replit.app`.

**Why:** dev and prod are separate Replit-managed databases. Never assume the dev DB
rows represent production. Any data migration/export MUST source from production.

**How to read production:** use the database skill `executeSql({ environment:"production" })`
— READ-ONLY (SELECT only), goes to a prod read replica. There is no external connection
string for it; the executeSql callback is the only access path.

**How prod data was moved to Railway (2026-06-04):**
- Schema: identical to dev (both from drizzle). `pg_dump --schema-only` the dev DB and
  apply to the target. The api-server boot only `CREATE TABLE`s a 7-table subset via
  `ensureIndexes`, which is why a fresh external DB 500s — the core tables are missing.
- Data export gotchas (code_execution sandbox):
  - sandbox has NO `process.env` and cannot resolve `pg` from workspace root — import it
    by full path `node_modules/.pnpm/pg@*/node_modules/pg/lib/index.js`, and put any code
    needing env vars / Railway secret in a **bash** `node` script instead.
  - `executeSql` output is CSV-escaped; JSON values break parsing. Work around it by
    selecting `replace(encode(convert_to(json_agg(t)::text,'UTF8'),'base64'), chr(10),'')`
    and base64-decoding in JS. Keyset-paginate on the PK to dodge output-size truncation.
- Load: bash node script + `pg`, wrap in a txn with `SET session_replication_role='replica'`
  to bypass FK ordering, then `setval(pg_get_serial_sequence(tbl,'id'), max(id), true)` per
  table so new inserts don't collide. Skip ephemeral tables (`cron_locks`, live `rooms`).
