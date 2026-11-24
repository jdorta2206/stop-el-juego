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

  it("counts sessions and actors independently without pairing starts and completions", () => {
    expect(funnelQuery).toMatch(/WITH recent_events AS MATERIALIZED/);
    expect(funnelQuery).toMatch(/session_counts AS/);
    expect(funnelQuery).toMatch(/COUNT\\(DISTINCT session_id\\) FILTER \\(WHERE event_name = 'session_start'\\)/);
    expect(funnelQuery).toMatch(/COUNT\\(DISTINCT session_id\\) FILTER \\(WHERE event_name = 'game_lobby_view'\\)/);
    expect(funnelQuery).toMatch(/player_counts AS/);
    expect(funnelQuery).toMatch(/FILTER \\(WHERE event_name = 'game_start'\\)/);
    expect(funnelQuery).toMatch(/FILTER \\(WHERE event_name = 'game_complete'\\)/);
    expect(funnelQuery).toMatch(/FROM session_counts CROSS JOIN player_counts/);
    expect(funnelQuery).not.toMatch(/GROUP BY session_id/);
    expect(funnelQuery).not.toMatch(/MAX\\(created_at\\)/);
    expect(funnelQuery).not.toMatch(/lobby_without_start|started_without_complete/);
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

describe("STOP Control funnel chart units", () => {
  it("renders sessions and unique players as separate charts, never one mixed funnel", () => {
    expect(adminRouteSource).toContain("sessionFunnelChart");
    expect(adminRouteSource).toContain("playerActivityChart");
    expect(adminRouteSource).toContain('"Navegación · sesiones · 7 días"');
    expect(adminRouteSource).toContain('"Actividad · jugadores únicos · 7 días"');
    expect(adminRouteSource).not.toContain("funnelChart");
  });
});

describe("STOP Control distinct actor identity", () => {
  it("keeps account IDs and guest session IDs in separate namespaces", () => {
    expect(adminRouteSource).not.toContain("COALESCE(player_id, session_id)");
    expect(adminRouteSource).toContain("THEN 'player:' || player_id ELSE 'session:' || session_id END");
  });
});


describe("STOP Control daily game-start version coverage", () => {
  it("uses the same trusted client game-start source as the 24-hour coverage KPI", () => {
    const queryStart = adminRouteSource.indexOf("const analyticsStartsByDayPromise =");
    const queryEnd = adminRouteSource.indexOf("`)).rows as Record<string, unknown>[];", queryStart);
    expect(queryStart).toBeGreaterThan(-1);
    expect(queryEnd).toBeGreaterThan(queryStart);
    const query = adminRouteSource.slice(queryStart, queryEnd);
    expect(query).toContain("event_name = 'game_start'");
    expect(query).toContain("metadata_json::jsonb->>'source' = 'client_game_start'");
    expect(query).toContain("app_version IS NOT NULL AND app_version <> ''");
    expect(query).toContain("created_at >= NOW() - INTERVAL '14 days'");
  });
});
