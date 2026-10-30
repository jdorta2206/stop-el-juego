import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const adminRouteSource = readFileSync(
  resolve(currentDir, "admin.ts"),
  "utf8",
);

// Inspect the actual production funnel SQL, not a separately copied predicate.
const funnelQueryMatch = adminRouteSource.match(
  /const funnel = \(\s*await db\.execute\(sql\`([\s\S]*?)\`\)\s*\)\.rows/,
);
if (!funnelQueryMatch) {
  throw new Error("Could not locate the production analytics funnel SQL in admin.ts");
}
const funnelQuery = funnelQueryMatch[1];

describe("STOP Control analytics funnel event ordering", () => {
  it("keeps the funnel restricted to trusted events in the seven-day window", () => {
    expect(funnelQuery).toMatch(/WHERE trusted = TRUE/);
    expect(funnelQuery).toMatch(/created_at >= NOW\(\) - INTERVAL '7 days'/);
  });

  it("requires a trusted game start in the same session at or after the lobby view", () => {
    const lobbyTransition = funnelQuery.match(
      /AS lobby_without_start([\s\S]*?)AS games_started/,
    )?.[1];
    expect(lobbyTransition).toBeDefined();
    expect(lobbyTransition).toMatch(/gs\.trusted = TRUE/);
    expect(lobbyTransition).toMatch(/gs\.event_name = 'game_start'/);
    expect(lobbyTransition).toMatch(/gs\.session_id = analytics_events\.session_id/);
    expect(lobbyTransition).toMatch(/gs\.created_at >= analytics_events\.created_at/);
    expect(lobbyTransition).toMatch(/gs\.created_at >= NOW\(\) - INTERVAL '7 days'/);
  });

  it("requires a trusted completion in the same session at or after the game start", () => {
    const completionTransition = funnelQuery.match(
      /AS started_without_complete([\s\S]*?)AS games_completed/,
    )?.[1];
    expect(completionTransition).toBeDefined();
    expect(completionTransition).toMatch(/gc\.trusted = TRUE/);
    expect(completionTransition).toMatch(/gc\.event_name = 'game_complete'/);
    expect(completionTransition).toMatch(/gc\.session_id = analytics_events\.session_id/);
    expect(completionTransition).toMatch(/gc\.created_at >= analytics_events\.created_at/);
    expect(completionTransition).toMatch(/gc\.created_at >= NOW\(\) - INTERVAL '7 days'/);
  });
});
