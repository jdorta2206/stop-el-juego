import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(
  resolve(currentDir, "../../../../artifacts/stop-game/src/pages/Home.tsx"),
  "utf8",
);
const dailyChallengeSource = readFileSync(
  resolve(currentDir, "../../../../artifacts/stop-game/src/pages/DailyChallenge.tsx"),
  "utf8",
);

describe("daily status timezone consistency", () => {
  it("sends the player's timezone from Home to the authoritative daily status endpoint", () => {
    expect(homeSource).toContain(
      'headers: { ...authHeaders(), "X-Stop-Timezone": timeZone }',
    );
    expect(homeSource).toContain('"/api/daily/status"');
  });

  it("keeps the Daily Challenge timezone header in place", () => {
    expect(dailyChallengeSource).toContain('"X-Stop-Timezone": getPlayerTimeZone()');
  });
  it("records HTTP status and request ID when Daily Challenge status lookup fails", () => {
    expect(dailyChallengeSource).toContain('error.status = r.status');
    expect(dailyChallengeSource).toContain('error.requestId = r.headers.get("X-Request-Id")');
    expect(dailyChallengeSource).toContain('endpoint: "/api/daily/status"');
    expect(dailyChallengeSource).toContain('phase: "daily_challenge_status"');
  });
});
