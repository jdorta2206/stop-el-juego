import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL_TEST;
const suite = databaseUrl ? describe : describe.skip;
const { Pool } = pg;

suite("PostgreSQL bonus-claim transaction concurrency", () => {
  const schema = `bonus_race_${randomUUID().replace(/-/g, "")}`;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  let first: pg.PoolClient;
  let second: pg.PoolClient;

  const table = (name: string) => `"${schema}"."${name}"`;

  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(`CREATE TABLE ${table("score_submission_claims")} (
      id bigserial PRIMARY KEY,
      player_id text NOT NULL,
      submission_id text NOT NULL,
      is_bonus boolean NOT NULL DEFAULT FALSE,
      UNIQUE (player_id, submission_id, is_bonus)
    )`);
    await pool.query(`CREATE TABLE ${table("score_bonus_claims")} (
      token_set_hash text PRIMARY KEY,
      player_id text NOT NULL,
      max_score integer NOT NULL
    )`);
    first = await pool.connect();
    second = await pool.connect();
  });

  afterAll(async () => {
    first?.release();
    second?.release();
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  });

  it("rolls back the losing submission ID when two transactions consume one reward claim", async () => {
    const playerId = "integration-player";
    const tokenHash = "single-reward-token";
    await pool.query(`INSERT INTO ${table("score_bonus_claims")} (token_set_hash, player_id, max_score) VALUES ($1, $2, 100)`, [tokenHash, playerId]);

    await first.query("BEGIN");
    await first.query(
      `INSERT INTO ${table("score_submission_claims")} (player_id, submission_id, is_bonus) VALUES ($1, $2, TRUE)`,
      [playerId, "submission-winner"],
    );
    const winner = await first.query(
      `DELETE FROM ${table("score_bonus_claims")} WHERE token_set_hash = $1 AND player_id = $2 RETURNING token_set_hash`,
      [tokenHash, playerId],
    );
    expect(winner.rowCount).toBe(1);

    await second.query("BEGIN");
    await second.query(
      `INSERT INTO ${table("score_submission_claims")} (player_id, submission_id, is_bonus) VALUES ($1, $2, TRUE)`,
      [playerId, "submission-loser"],
    );
    const losingDelete = second.query(
      `DELETE FROM ${table("score_bonus_claims")} WHERE token_set_hash = $1 AND player_id = $2 RETURNING token_set_hash`,
      [tokenHash, playerId],
    );

    // Wait until PostgreSQL confirms that the second DELETE is blocked on the
    // row lock held by the first transaction. This makes the race deterministic.
    let isWaitingOnLock = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const activity = await pool.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1",
        [second.processID],
      );
      if (activity.rows[0]?.wait_event_type === "Lock") {
        isWaitingOnLock = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(isWaitingOnLock).toBe(true);

    await first.query("COMMIT");
    const loser = await losingDelete;
    expect(loser.rowCount).toBe(0);

    // Mirrors the route's throw-on-missing-claim behavior: abort the complete
    // transaction so its previously inserted submission ID is not committed.
    await second.query("ROLLBACK");

    const persisted = await pool.query(
      `SELECT submission_id FROM ${table("score_submission_claims")} WHERE player_id = $1 ORDER BY submission_id`,
      [playerId],
    );
    expect(persisted.rows.map((row) => row.submission_id)).toEqual(["submission-winner"]);
    const remainingClaims = await pool.query(
      `SELECT count(*)::int AS count FROM ${table("score_bonus_claims")} WHERE token_set_hash = $1`,
      [tokenHash],
    );
    expect(remainingClaims.rows[0].count).toBe(0);
  });

  it("does not persist a submission ID when the bonus amount is outside the claim limit", async () => {
    const playerId = "invalid-score-player";
    const tokenHash = "bounded-reward-token";
    await pool.query(`INSERT INTO ${table("score_bonus_claims")} (token_set_hash, player_id, max_score) VALUES ($1, $2, 100)`, [tokenHash, playerId]);

    await first.query("BEGIN");
    await first.query(
      `INSERT INTO ${table("score_submission_claims")} (player_id, submission_id, is_bonus) VALUES ($1, $2, TRUE)`,
      [playerId, "invalid-submission"],
    );
    const claimed = await first.query(
      `DELETE FROM ${table("score_bonus_claims")} WHERE token_set_hash = $1 AND player_id = $2 RETURNING max_score`,
      [tokenHash, playerId],
    );
    expect(claimed.rows[0].max_score).toBe(100);
    const submittedScore = 101;
    if (submittedScore <= 0 || submittedScore > claimed.rows[0].max_score) {
      await first.query("ROLLBACK");
    }

    const persisted = await pool.query(
      `SELECT submission_id FROM ${table("score_submission_claims")} WHERE player_id = $1`,
      [playerId],
    );
    expect(persisted.rows).toHaveLength(0);
    const restoredClaim = await pool.query(
      `SELECT max_score FROM ${table("score_bonus_claims")} WHERE token_set_hash = $1`,
      [tokenHash],
    );
    expect(restoredClaim.rows[0]?.max_score).toBe(100);
  });
});
