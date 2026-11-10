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

  it("uses one bounded seven-day event set and aggregates transitions per session", () => {
    expect(funnelQuery).toMatch(/WITH recent_events AS MATERIALIZED/);
    expect(funnelQuery).toMatch(/WHERE trusted = TRUE/);
    expect(funnelQuery).toMatch(/created_at >= NOW\(\) - INTERVAL '7 days'/);
    expect(funnelQuery).toMatch(/GROUP BY session_id/);
    expect(funnelQuery).toMatch(/MAX\(created_at\) FILTER \(WHERE event_name = 'game_lobby_view'\)/);
    expect(funnelQuery).toMatch(/MAX\(created_at\) FILTER \(WHERE event_name = 'game_start'\)/);
    expect(funnelQuery).toMatch(/MAX\(created_at\) FILTER \(WHERE event_name = 'game_complete'\)/);
    expect(funnelQuery).not.toMatch(/NOT EXISTS/);
  });
});

describe("STOP Control panel query performance", () => {
  it("runs the 26 independent queries in parallel with bounded concurrency and timeouts", () => {
    expect(adminRouteSource).toContain("const PANEL_QUERY_CONCURRENCY = 5");
    expect(adminRouteSource).toContain("SET LOCAL statement_timeout = '5000ms'");
    expect(adminRouteSource).toContain("await Promise.all");
    expect(adminRouteSource.match(/const \w+Promise = \(async \(\) =>/g)?.length).toBe(26);
  });

  it("uses a 60-second stale-while-revalidate cache and avoids costly metadata LIKE scans", () => {
    expect(adminRouteSource).toContain("cachedAdminPanelAt < 60_000");
    expect(adminRouteSource).toContain('X-STOP-Admin-Cache');
    expect(adminRouteSource).not.toContain("metadata_json LIKE");
    expect(adminRouteSource).not.toMatch(/\(updated_at AT TIME ZONE 'UTC'\) >=/);
    expect(adminRouteSource).not.toMatch(/\(created_at AT TIME ZONE 'UTC'\) >=/);
  });
});


describe("STOP Control analytics failure safety", () => {
  it("never converts a failed query into an empty result that looks like zero activity", () => {
    expect(adminRouteSource).toContain("throw error;");
    expect(adminRouteSource).not.toContain("return { rows: [] } as any");
    expect(adminRouteSource).toContain("preserving last complete panel");
  });

  it("does not replace the last complete cached panel until all parallel queries succeed", () => {
    const cacheWrite = adminRouteSource.indexOf("cachedAdminPanelHtml = html");
    const allQueries = adminRouteSource.indexOf("] = await Promise.all([");
    expect(allQueries).toBeGreaterThan(-1);
    expect(cacheWrite).toBeGreaterThan(allQueries);
    expect(adminRouteSource).toContain("if (hasCachedHtml)");
  });
});
