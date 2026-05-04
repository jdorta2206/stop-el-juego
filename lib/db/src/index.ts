import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Tuned pool for high concurrency. Most managed Postgres tiers allow ~100
// concurrent client connections; we leave headroom for migrations / Stripe sync
// and other consumers. Idle connections are recycled aggressively to free server
// slots, and statement_timeout prevents a runaway query from hogging a slot.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 50),
  min: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Hard cap query duration server-side (60s). Anything slower indicates
  // a missing index or a runaway scan and we'd rather fail fast.
  statement_timeout: 60_000,
});

// Don't crash the process on transient connection errors — log and continue.
pool.on("error", (err) => {
  console.error("[pg pool] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { ensureIndexes } from "./migrate";
