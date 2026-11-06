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
const funnelPromiseStart = adminRouteSource.indexOf("const funnelPromise =");
const funnelSqlStart = adminRouteSource.indexOf("executePanelQuery(sql`", funnelPromiseStart);
const funnelSqlEnd = adminRouteSource.indexOf("`)", funnelSqlStart);
if (funnelPromiseStart < 0 || funnelSqlStart < 0 || funnelSqlEnd < 0) {
  throw new Error("Could not locate the production analytics funnel SQL in admin.ts");
}
const funnelQuery = adminRouteSource.slice(
  funnelSqlStart + "executePanelQuery(sql`".length,
  funnelSqlEnd,
);

describe("STOP Control analytics funnel event ordering", () => {
  it("keeps the funnel restricted to trusted events in the seven-day window", () => {
    expect(funnelQuery).toMatch(/WHERE trusted = TRUE/);
    expect(funnelQuery).toMatch(/created_at >= NOW\(\) - INTERVAL '7 days'/);
  });

  it("requires a trusted game start in the same session at or after the lobby view", () => {
    const lobbyTransition = funnelQuery.match(
      /COUNT\(DISTINCT CASE\s+WHEN event_name = 'game_lobby_view'[\s\S]*?AS lobby_without_start/,
    )?.[0];
    expect(lobbyTransition).toBeDefined();
    expect(lobbyTransition).toMatch(/gs\.trusted = TRUE/);
    expect(lobbyTransition).toMatch(/gs\.event_name = 'game_start'/);
    expect(lobbyTransition).toMatch(/gs\.session_id = analytics_events\.session_id/);
    expect(lobbyTransition).toMatch(/gs\.created_at >= analytics_events\.created_at/);
    expect(lobbyTransition).toMatch(/gs\.created_at >= NOW\(\) - INTERVAL '7 days'/);
  });

  it("requires a trusted completion in the same session at or after the game start", () => {
    const completionTransition = funnelQuery.match(
      /COUNT\(DISTINCT CASE\s+WHEN event_name = 'game_start'[\s\S]*?AS started_without_complete/,
    )?.[0];
    expect(completionTransition).toBeDefined();
    expect(completionTransition).toMatch(/gc\.trusted = TRUE/);
    expect(completionTransition).toMatch(/gc\.event_name = 'game_complete'/);
    expect(completionTransition).toMatch(/gc\.session_id = analytics_events\.session_id/);
    expect(completionTransition).toMatch(/gc\.created_at >= analytics_events\.created_at/);
    expect(completionTransition).toMatch(/gc\.created_at >= NOW\(\) - INTERVAL '7 days'/);
  });
});

describe("STOP Control panel query performance", () => {
  it("runs the 26 independent queries in parallel with bounded concurrency and timeouts", () => {
    expect(adminRouteSource).toContain("const PANEL_QUERY_CONCURRENCY = 5");
    expect(adminRouteSource).toContain("SET LOCAL statement_timeout = '1800ms'");
    expect(adminRouteSource).toContain("await Promise.all");
    expect(adminRouteSource.match(/const \\w+Promise = \\(async \\(\\) =>/g)?.length).toBe(26);
  });

  it("uses a 60-second stale-while-revalidate cache and avoids costly metadata LIKE scans", () => {
    expect(adminRouteSource).toContain("cachedAdminPanelAt < 60_000");
    expect(adminRouteSource).toContain('X-STOP-Admin-Cache');
    expect(adminRouteSource).not.toContain("metadata_json LIKE");
    expect(adminRouteSource).not.toMatch(/\\(updated_at AT TIME ZONE 'UTC'\\) >=/);
    expect(adminRouteSource).not.toMatch(/\\(created_at AT TIME ZONE 'UTC'\\) >=/);
  });
});
