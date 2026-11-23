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

describe("STOP analytics client version attribution", () => {
  it("does not label TWA requests without a version header as the legacy 1.3.6.9 build", () => {
    expect(analyticsRouteSource).not.toContain("CURRENT_TWA_ANALYTICS_VERSION");
    expect(analyticsRouteSource).toContain("return isTwaRequest(req) ? null : CURRENT_WEB_ANALYTICS_VERSION");
  });
});
