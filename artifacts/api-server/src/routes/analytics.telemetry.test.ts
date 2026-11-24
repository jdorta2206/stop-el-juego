describe("STOP analytics crawler filtering", () => {
  it("recognizes common search and social crawlers without blocking page delivery", () => {
    expect(analyticsRouteSource).toContain("const KNOWN_CRAWLER_USER_AGENT");
    expect(analyticsRouteSource).toContain("function isKnownCrawler(req: Request): boolean");
    expect(analyticsRouteSource).toContain("if (isKnownCrawler(req) || req.path === \"/summary\"");
  });

  it("ignores crawler writes to analytics endpoints while preserving normal clients", () => {
    expect(analyticsRouteSource).toContain("function ignoreCrawlerTelemetry(req: Request, res: any): boolean");
    for (const route of ["/heartbeat", "/game-start", "/client-error", "/event"]) {
      const routeStart = analyticsRouteSource.indexOf(`router.post("${route}"`);
      const nextRoute = analyticsRouteSource.indexOf('router.post("', routeStart + 1);
      const section = analyticsRouteSource.slice(routeStart, nextRoute < 0 ? undefined : nextRoute);
      expect(section).toContain("if (ignoreCrawlerTelemetry(req, res)) return;");
    }
    expect(analyticsRouteSource).toContain('res.status(200).json({ ok: true, ignored: true })');
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const analyticsRouteSource = readFileSync(
  resolve(currentDir, "analytics.ts"),
  "utf8",
);
const adminAnalyticsRouteSource = readFileSync(
  resolve(currentDir, "adminAnalytics.ts"),
  "utf8",
);
const allowlistMatch = analyticsRouteSource.match(
  /const TRUSTED_CLIENT_TELEMETRY_EVENTS = new Set\(([\s\S]*?)\);/,
);
if (!allowlistMatch) {
  throw new Error("Could not locate the production client telemetry allowlist");
}

describe("STOP gameplay telemetry allowlist", () => {
  it("includes completion and rewarded-ad events consumed by STOP Control", () => {
    const allowlist = allowlistMatch[1];
    for (const eventName of [
      "game_complete",
      "rewarded_ad_requested",
      "rewarded_ad_completed",
      "rewarded_ad_failed",
      "powerup_used",
      "lobby_view",
      "lobby_ready",
      "lobby_auth_resolved",
      "lobby_daily_status_started",
      "lobby_daily_status_succeeded",
      "lobby_daily_status_failed",
      "lobby_room_load_started",
      "lobby_room_loaded",
      "lobby_room_load_failed",
      "lobby_api_timeout",
      "lobby_auth_failed",
      "lobby_page_exit",
      "rewarded_ad_pending",
      "rewarded_ad_request_created",
    ]) {
      expect(allowlist).toContain(`"${eventName}"`);
    }
  });

  it("keeps telemetry trust classification separate from the reward-granting SSV flow", () => {
    expect(analyticsRouteSource).not.toContain('  "solo_round_validation",');
    expect(analyticsRouteSource).toContain("const trusted = TRUSTED_CLIENT_TELEMETRY_EVENTS.has(eventName)");
    expect(analyticsRouteSource).toContain('router.post("/event"');
    expect(analyticsRouteSource).toContain('router.post("/game-start"');
  });

  it("redacts secret-like key/value diagnostics before rendering STOP Analytics", () => {
    expect(adminAnalyticsRouteSource).toContain(
      "/(token|password|cookie|secret|authorization|api[_-]?key)\\s*[:=]\\s*[^\\s,;]+/gi",
    );
    expect(adminAnalyticsRouteSource).toContain("[redactado]");
  });

  it("sanitizes metadata before every analytics event persistence path", () => {
    expect(analyticsRouteSource).toContain(
      "JSON.stringify(sanitizeClientMetadata(input.metadata ?? {}))",
    );
    expect(analyticsRouteSource).toContain(
      "JSON.stringify(sanitizeClientMetadata(metadata))",
    );
    expect(analyticsRouteSource).toContain(
      "/password|token|secret|authorization|cookie|api[_-]?key/i",
    );
  });

});

describe("STOP client error resource diagnostics", () => {
  it("stores bounded resource-load context while stripping URL query strings and fragments", () => {
    const route = analyticsRouteSource.slice(
      analyticsRouteSource.indexOf('router.post("/client-error"'),
      analyticsRouteSource.indexOf('router.post("/event"'),
    );
    expect(route).toContain('body.context && typeof body.context === "object"');
    expect(route).toContain('["resource_url", "filename"]');
    expect(route).toContain("(parsed.origin + parsed.pathname).slice(0, 400)");
    expect(route).toContain("redactClientDiagnostic(body.stack, 1200)");
    expect(route).toContain("redactClientDiagnostic(body.componentStack, 1200)");
    expect(route).toContain('["source", "error_kind", "phase", "resource_tag", "lazy_page", "module_exports"]');
    expect(route).toContain("context: diagnosticContext");
    expect(route).not.toContain("JSON.stringify({ message, stack, componentStack })");
  });
});

describe("STOP trusted game-start delivery", () => {
  it("retries transient client failures with a stable idempotency key", () => {
    const clientSource = readFileSync(
      resolve(currentDir, "../../../stop-game/src/lib/analyticsClient.ts"),
      "utf8",
    );
    expect(clientSource).toContain("const eventId");
    expect(clientSource).toContain("attempt < 2");
    expect(clientSource).toContain("response.status < 500");
    expect(clientSource).toContain("eventId,");
  });

  it("deduplicates retried game-start requests on the server", () => {
    expect(analyticsRouteSource).toContain("pg_advisory_xact_lock(hashtextextended");
    expect(analyticsRouteSource).toContain("metadata_json::jsonb->>'eventId'");
    expect(analyticsRouteSource).toContain("source: \"client_game_start\"");
  });
});

describe("STOP analytics attribution", () => {
  it("does not invent a legacy version for TWA requests without a version header", () => {
    expect(analyticsRouteSource).not.toContain("CURRENT_TWA_ANALYTICS_VERSION");
    expect(analyticsRouteSource).toContain("return isTwaRequest(req) ? null : CURRENT_WEB_ANALYTICS_VERSION");
  });

  it("uses the shared TWA detector for Android platform attribution", () => {
    expect(analyticsRouteSource).toContain("const twa = isTwaRequest(req);");
  });

  it("refreshes the app version when an existing passive session reports activity", () => {
    expect(analyticsRouteSource).toContain("app_version = EXCLUDED.app_version, last_seen = NOW()");
  });
});
