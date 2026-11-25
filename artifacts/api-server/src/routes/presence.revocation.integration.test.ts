import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

integration("PostgreSQL presence revocation lock integration", () => {
  let pool: typeof import("@workspace/db").pool;
  const schema = "stop_presence_revocation_it";
  const playerId = `presence-revocation-it-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    // Import only after Vitest has received the isolated CI DATABASE_URL.
    ({ pool } = await import("@workspace/db"));
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.revoked_player_ids (
        player_id text PRIMARY KEY
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.player_presence (
        player_id text PRIMARY KEY,
        last_seen timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`DELETE FROM ${schema}.revoked_player_ids WHERE player_id = $1`, [playerId]);
    await pool.query(`DELETE FROM ${schema}.player_presence WHERE player_id = $1`, [playerId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM ${schema}.revoked_player_ids WHERE player_id = $1`, [playerId]);
    await pool.query(`DELETE FROM ${schema}.player_presence WHERE player_id = $1`, [playerId]);
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it("makes a ping wait for deletion, then blocks presence recreation after revocation commits", async () => {
    const deletion = await pool.connect();
    const ping = await pool.connect();
    const probe = await pool.connect();
    let pingReachedLock = false;

    try {
      await deletion.query("BEGIN");
      await deletion.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [playerId],
      );
      await deletion.query(
        `INSERT INTO ${schema}.revoked_player_ids (player_id) VALUES ($1)`,
        [playerId],
      );

      await ping.query("BEGIN");
      const pingTransaction = (async () => {
        pingReachedLock = true;
        await ping.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [playerId],
        );
        const revoked = await ping.query(
          `SELECT 1 FROM ${schema}.revoked_player_ids WHERE player_id = $1 LIMIT 1`,
          [playerId],
        );
        if (revoked.rowCount === 0) {
          await ping.query(
            `INSERT INTO ${schema}.player_presence (player_id) VALUES ($1)
             ON CONFLICT (player_id) DO UPDATE SET last_seen = NOW()`,
            [playerId],
          );
        }
        await ping.query("COMMIT");
        return revoked.rowCount === 1;
      })();

      // Wait until the ping has issued its lock request, then independently
      // prove the deletion transaction still owns the same advisory lock.
      while (!pingReachedLock) await new Promise((resolve) => setTimeout(resolve, 1));
      const lockProbe = await probe.query(
        "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
        [playerId],
      );
      expect(lockProbe.rows[0]?.acquired).toBe(false);
      await probe.query("ROLLBACK");

      await deletion.query("COMMIT");
      expect(await pingTransaction).toBe(true);

      const presence = await pool.query(
        `SELECT 1 FROM ${schema}.player_presence WHERE player_id = $1`,
        [playerId],
      );
      expect(presence.rowCount).toBe(0);
    } finally {
      await deletion.query("ROLLBACK").catch(() => {});
      await ping.query("ROLLBACK").catch(() => {});
      await probe.query("ROLLBACK").catch(() => {});
      deletion.release();
      ping.release();
      probe.release();
    }
  });

  it("allows a non-revoked player to create presence under the same lock", async () => {
    const connection = await pool.connect();
    const activePlayerId = `${playerId}-active`;
    try {
      await connection.query("BEGIN");
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [activePlayerId],
      );
      const revoked = await connection.query(
        `SELECT 1 FROM ${schema}.revoked_player_ids WHERE player_id = $1 LIMIT 1`,
        [activePlayerId],
      );
      expect(revoked.rowCount).toBe(0);
      await connection.query(
        `INSERT INTO ${schema}.player_presence (player_id) VALUES ($1)
         ON CONFLICT (player_id) DO UPDATE SET last_seen = NOW()`,
        [activePlayerId],
      );
      await connection.query("COMMIT");

      const presence = await pool.query(
        `SELECT 1 FROM ${schema}.player_presence WHERE player_id = $1`,
        [activePlayerId],
      );
      expect(presence.rowCount).toBe(1);
    } finally {
      await connection.query("ROLLBACK").catch(() => {});
      await pool.query(`DELETE FROM ${schema}.player_presence WHERE player_id = $1`, [activePlayerId]);
      connection.release();
    }
  });
});
