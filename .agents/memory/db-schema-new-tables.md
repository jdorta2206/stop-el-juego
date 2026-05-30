---
name: Adding a new DB table (STOP monorepo)
description: The exact steps to add a Drizzle table so it works in dev AND production
---

# Adding a new table to `@workspace/db`

Three non-obvious gotchas bite when adding a new Drizzle table in this repo:

1. **`@workspace/db` is a composite TS project (project references).** Consumers
   (e.g. `api-server`) typecheck against the package's built `.d.ts` in
   `lib/db/dist`, NOT the source. After adding/exporting a new table you must
   regenerate declarations or you get `TS2305: Module '@workspace/db' has no
   exported member 'XxxTable'`.
   **Fix:** `cd lib/db && npx tsc -b` (there is no `build` script).

2. **Production has no `drizzle-kit push` step.** The runtime migration path is
   `lib/db/src/migrate.ts` → `ensureIndexes()`, which runs on every API boot and
   creates new tables with `CREATE TABLE IF NOT EXISTS ...`. If you skip this, the
   table never exists in prod. Any route that swallows DB errors will then silently
   drop all writes while appearing to work.
   **Fix:** add a `CREATE TABLE IF NOT EXISTS` block to the `stmts` array in
   `ensureIndexes()` (near the `cron_locks` / `season_finals` blocks).

3. **`drizzle-kit push` is an interactive TUI** that does NOT accept piped stdin
   (`printf '\n' | ... push` just re-renders the prompt). For dev, create the
   table directly via SQL (`executeSql` in the code sandbox) instead of fighting
   the TUI.

**Why:** missing #1 fails the build; missing #2 causes silent prod data loss
(handlers that return 204 on error hide it); #3 wastes time on a hung command.
