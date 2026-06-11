---
name: DB schema drift — never run drizzle-kit push
description: The prod/dev Postgres has tables not in the Drizzle schema; drizzle-kit push tries to DROP them. Add tables via raw SQL instead.
---

# Adding tables: do NOT use `drizzle-kit push`

The live database (shared dev + Railway prod) contains tables that are **not**
declared in the `@workspace/db` Drizzle schema — at least `cron_locks`
(thousands of rows) and `season_finals`. Because they're absent from the
schema, `pnpm --filter @workspace/db run push` (drizzle-kit push) interprets
them as deletions and prompts to DROP them ("data-loss statements"). It also
mis-offers them as rename targets for any new table.

**Why:** the schema and DB have drifted; drizzle-kit push reconciles by
removing anything not in the schema. Accepting its prompts would wipe real
data.

**How to apply:** to add a new table, (1) declare it in
`lib/db/src/schema/*.ts` for the types, (2) create it in the DB by hand with
`psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS ..."` matching the
Drizzle column definitions exactly, and (3) apply the same `CREATE TABLE` to
Railway prod manually at deploy time. Never run `push` / `push-force`.

# @workspace/db is a composite TS project — rebuild its .d.ts

`lib/db/tsconfig.json` is `composite: true` + `emitDeclarationOnly` → `dist/`.
Consumers (api-server) resolve types from `lib/db/dist/**/*.d.ts`, NOT from
`src`. After editing `lib/db/src/schema/*`, the new exports won't typecheck in
api-server until you rebuild declarations:
`cd lib/db && npx tsc -p tsconfig.json`. There is no `build` npm script.
