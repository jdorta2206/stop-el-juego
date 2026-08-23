import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Railway/Postgres: keep the pool deliberately small and recycle idle sockets.
// A large pool (50 clients) is unnecessary for the single Railway replica and
// can amplify transient database disconnects when several cron jobs run together.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 20),
  min: 0,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  statement_timeout: 60_000,
});

// PostgreSQL/Railway can close an idle socket transiently. node-postgres removes
// the failed idle client from the pool; logging it must never terminate the app.
pool.on("error", (err) => {
  console.error("[pg pool] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { ensureIndexes, indexesReady } from "./migrate";
