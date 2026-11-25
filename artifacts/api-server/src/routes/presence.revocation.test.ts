import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const presenceRouteSource = readFileSync(
  resolve(currentDir, "presence.ts"),
  "utf8",
);

describe("STOP presence account-revocation guard", () => {
  it("checks revocation only after acquiring the same per-player advisory lock", () => {
    const lock = presenceRouteSource.indexOf(
      'pg_advisory_xact_lock(hashtextextended(${playerId}, 0))',
    );
    const revocationCheck = presenceRouteSource.indexOf(
      "FROM revoked_player_ids",
      lock,
    );
    const presenceUpsert = presenceRouteSource.indexOf(
      "INSERT INTO player_presence",
      lock,
    );

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(revocationCheck).toBeGreaterThan(lock);
    expect(presenceUpsert).toBeGreaterThan(revocationCheck);
  });

  it("rejects a revoked identity and clears its local presence cache", () => {
    const revokedBranch = presenceRouteSource.slice(
      presenceRouteSource.indexOf("if (pingResult.revoked)"),
      presenceRouteSource.indexOf("const wasOffline = pingResult.wasOffline"),
    );

    expect(revokedBranch).toContain("presenceMap.delete(playerId)");
    expect(revokedBranch).toContain('res.status(403).json({ error: "Invalid player identity" })');
  });

  it("preserves the normal successful ping response and follower notification path", () => {
    expect(presenceRouteSource).toContain("if (wasOffline && profile.provider && profile.provider !== \"guest\")");
    expect(presenceRouteSource).toContain("notifyFollowersPlayerOnline(playerId, profile.name, language || \"es\")");
    expect(presenceRouteSource).toContain("return res.json({ ok: true })");
  });
});
